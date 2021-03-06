# MySQL Connector/Python - MySQL driver written in Python.


import re
import django
if django.VERSION < (1, 8):
    from django.db.backends import BaseDatabaseIntrospection
else:
    from django.db.backends.base.introspection import BaseDatabaseIntrospection

if django.VERSION >= (1, 6):
    if django.VERSION < (1, 8):
        from django.db.backends import FieldInfo
    else:
        from django.db.backends.base.introspection import FieldInfo, TableInfo
    from django.utils.encoding import force_text
    if django.VERSION >= (1, 7):
        from django.utils.datastructures import OrderedSet

from mysql.connector.constants import FieldType

foreign_key_re = re.compile(r"\sCONSTRAINT `[^`]*` FOREIGN KEY \(`([^`]*)`\) "
                            r"REFERENCES `([^`]*)` \(`([^`]*)`\)")


class DatabaseIntrospection(BaseDatabaseIntrospection):
    data_types_reverse = {
        FieldType.BLOB: 'TextField',
        FieldType.DECIMAL: 'DecimalField',
        FieldType.NEWDECIMAL: 'DecimalField',
        FieldType.DATE: 'DateField',
        FieldType.DATETIME: 'DateTimeField',
        FieldType.DOUBLE: 'FloatField',
        FieldType.FLOAT: 'FloatField',
        FieldType.INT24: 'IntegerField',
        FieldType.LONG: 'IntegerField',
        FieldType.LONGLONG: 'BigIntegerField',
        FieldType.SHORT: 'IntegerField',
        FieldType.STRING: 'CharField',
        FieldType.TIME: 'TimeField',
        FieldType.TIMESTAMP: 'DateTimeField',
        FieldType.TINY: 'IntegerField',
        FieldType.TINY_BLOB: 'TextField',
        FieldType.MEDIUM_BLOB: 'TextField',
        FieldType.LONG_BLOB: 'TextField',
        FieldType.VAR_STRING: 'CharField',
    }

    def get_table_list(self, cursor):
        "Returns a list of table names in the current database."
        if django.VERSION < (1, 8):
            cursor.execute("SHOW TABLES")
            return [row[0] for row in cursor.fetchall()]
        else:
            cursor.execute("SHOW FULL TABLES")
            return [TableInfo(row[0], {'BASE TABLE': 't', 'VIEW': 'v'}.get(row[1]))
                    for row in cursor.fetchall()]

    def get_table_description(self, cursor, table_name):
        """
        Returns a description of the table, with the DB-API cursor.description
        interface."
        """
        # varchar length returned by cursor.description is an internal length,
        # not visible length (#5725), use information_schema database to fix
        # this
        cursor.execute(
            "SELECT column_name, character_maximum_length "
            "FROM INFORMATION_SCHEMA.COLUMNS "
            "WHERE table_name = %s AND table_schema = DATABASE() "
            "AND character_maximum_length IS NOT NULL", [table_name])
        length_map = dict(cursor.fetchall())

        # Also getting precision and scale from information_schema (see #5014)
        cursor.execute(
            "SELECT column_name, numeric_precision, numeric_scale FROM "
            "INFORMATION_SCHEMA.COLUMNS WHERE table_name = %s AND "
            "table_schema = DATABASE() AND data_type='decimal'", [table_name])
        numeric_map = dict((line[0], tuple([int(n) for n in line[1:]]))
                           for line in cursor.fetchall())

        cursor.execute("SELECT * FROM {0} LIMIT 1".format(
            self.connection.ops.quote_name(table_name)))
        if django.VERSION >= (1, 6):
            return [FieldInfo(*((force_text(line[0]),)
                                + line[1:3]
                                + (length_map.get(line[0], line[3]),)
                                + numeric_map.get(line[0], line[4:6])
                                + (line[6],)))
                    for line in cursor.description]
        else:
            return [line[:3] + (length_map.get(line[0], line[3]),) + line[4:]
                    for line in cursor.description]

    def _name_to_index(self, cursor, table_name):
        """
        Returns a dictionary of {field_name: field_index} for the given table.
        Indexes are 0-based.
        """
        return dict((d[0], i) for i, d in enumerate(
                    self.get_table_description(cursor, table_name)))

    def get_relations(self, cursor, table_name):
        """
        Returns a dictionary of {field_index: (field_index_other_table,
        other_table)}
        representing all relationships to the given table. Indexes are 0-based.
        """
        my_field_dict = self._name_to_index(cursor, table_name)
        constraints = self.get_key_columns(cursor, table_name)
        relations = {}
        for my_fieldname, other_table, other_field in constraints:
            other_field_index = self._name_to_index(cursor,
                                                    other_table)[other_field]
            my_field_index = my_field_dict[my_fieldname]
            relations[my_field_index] = (other_field_index, other_table)
        return relations

    def get_key_columns(self, cursor, table_name):
        """
        Returns a list of (column_name, referenced_table_name,
        referenced_column_name) for all key columns in given table.
        """
        key_columns = []
        cursor.execute(
            "SELECT column_name, referenced_table_name, referenced_column_name "
            "FROM information_schema.key_column_usage "
            "WHERE table_name = %s "
            "AND table_schema = DATABASE() "
            "AND referenced_table_name IS NOT NULL "
            "AND referenced_column_name IS NOT NULL", [table_name])
        key_columns.extend(cursor.fetchall())
        return key_columns

    def get_indexes(self, cursor, table_name):
        cursor.execute("SHOW INDEX FROM {0}"
                       "".format(self.connection.ops.quote_name(table_name)))
        # Do a two-pass search for indexes: on first pass check which indexes
        # are multicolumn, on second pass check which single-column indexes
        # are present.
        rows = list(cursor.fetchall())
        multicol_indexes = set()
        for row in rows:
            if row[3] > 1:
                multicol_indexes.add(row[2])
        indexes = {}
        for row in rows:
            if row[2] in multicol_indexes:
                continue
            if row[4] not in indexes:
                indexes[row[4]] = {'primary_key': False, 'unique': False}
            # It's possible to have the unique and PK constraints in
            # separate indexes.
            if row[2] == 'PRIMARY':
                indexes[row[4]]['primary_key'] = True
            if not row[1]:
                indexes[row[4]]['unique'] = True
        return indexes

    def get_primary_key_column(self, cursor, table_name):
        """
        Returns the name of the primary key column for the given table
        """
        # Django 1.6
        for column in self.get_indexes(cursor, table_name).items():
            if column[1]['primary_key']:
                return column[0]
        return None

    def get_constraints(self, cursor, table_name):
        """
        Retrieves any constraints or keys (unique, pk, fk, check, index) across
        one or more columns.
        """
        # Django 1.7
        constraints = {}
        # Get the actual constraint names and columns
        name_query = (
            "SELECT kc.`constraint_name`, kc.`column_name`, "
            "kc.`referenced_table_name`, kc.`referenced_column_name` "
            "FROM information_schema.key_column_usage AS kc "
            "WHERE "
            "kc.table_schema = %s AND "
            "kc.table_name = %s"
        )
        cursor.execute(name_query, [self.connection.settings_dict['NAME'],
                                    table_name])
        for constraint, column, ref_table, ref_column in cursor.fetchall():
            if constraint not in constraints:
                constraints[constraint] = {
                    'columns': OrderedSet(),
                    'primary_key': False,
                    'unique': False,
                    'index': False,
                    'check': False,
                    'foreign_key': (ref_table, ref_column) if ref_column else None,
                }
            constraints[constraint]['columns'].add(column)
        # Now get the constraint types
        type_query = """
            SELECT c.constraint_name, c.constraint_type
            FROM information_schema.table_constraints AS c
            WHERE
                c.table_schema = %s AND
                c.table_name = %s
        """
        cursor.execute(type_query, [self.connection.settings_dict['NAME'],
                                    table_name])
        for constraint, kind in cursor.fetchall():
            if kind.lower() == "primary key":
                constraints[constraint]['primary_key'] = True
                constraints[constraint]['unique'] = True
            elif kind.lower() == "unique":
                constraints[constraint]['unique'] = True
        # Now add in the indexes
        cursor.execute("SHOW INDEX FROM %s" % self.connection.ops.quote_name(
            table_name))
        for table, non_unique, index, colseq, column in [x[:5] for x in
                                                         cursor.fetchall()]:
            if index not in constraints:
                constraints[index] = {
                    'columns': OrderedSet(),
                    'primary_key': False,
                    'unique': False,
                    'index': True,
                    'check': False,
                    'foreign_key': None,
                }
            constraints[index]['index'] = True
            constraints[index]['columns'].add(column)
        # Convert the sorted sets to lists
        for constraint in constraints.values():
            constraint['columns'] = list(constraint['columns'])
        return constraints
