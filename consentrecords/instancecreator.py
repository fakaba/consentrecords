from django.db import connection

import logging
import datetime
import numbers
import uuid

from consentrecords.models import *
from consentrecords import pathparser

def _addElementData(parent, data, fieldData, nameLists, transactionState):
    # If the data is not a list, then treat it as a list of one item.
    if not isinstance(data, list):
        data = [data]

    i = 0
    ids = []
    field = Instance.objects.get(pk=fieldData["nameID"])
    userInfo=UserInfo(transactionState.user)
    for d in data:
        if not isinstance(d, dict):
            raise RuntimeError("%s field of type %s is not a dictionary: %s" % (field, parent.typeID, str(d)))
            
        if fieldData["dataTypeID"] == terms.objectEnum.id:
            if "objectAddRule" in fieldData and fieldData["objectAddRule"] == "_pick one":
                if "instanceID" in d:
                    # This is a reference to an object.
                    values = list(userInfo.findFilter(Instance.objects.filter(pk=d["instanceID"])))
                    if len(values):
                        parent.addReferenceValue(field, values[0], i, transactionState)
                    elif d["instanceID"] == parent.id and field == terms.primaryAdministrator:
                        # This is a special case of setting up the primary administrator. This
                        # is necessary when creating a user so that it can be bootstrapped.
                        parent.addReferenceValue(field, parent, i, transactionState)
                    else:
                        raise RuntimeError("find permission failed for %s" % field)
                elif "path" in d:
                    ids = pathparser.selectAllObjects(d["path"], userInfo=userInfo, securityFilter=userInfo.findFilter)
                    if len(ids):
                        parent.addReferenceValue(field, ids[-1], i, transactionState)
                    else:
                        raise RuntimeError("Path does not parse to an object: %s" % d["path"])
                else:
                    raise RuntimeError("%s field of type %s contains neither instanceID nor path: %s" % (field, parent.typeID, str(d)))
            else:
                if "cells" in d and "ofKindID" in fieldData:
                    ofKindObject = Instance.objects.get(pk=fieldData["ofKindID"])
                    create(ofKindObject, parent, field, -1, d["cells"], nameLists, transactionState)
                else:
                    raise RuntimeError("%s field of type %s not configured to contain data: %s" % (field, parent.typeID, str(d)))
        else:
            parent.addValue(field, d, i, transactionState)
        i += 1

def create(typeInstance, parent, parentField, position, propertyList, nameLists, transactionState):
#     logger = logging.getLogger(__name__)
#     logger.error("typeInstance: %s" % typeInstance._description)
#     logger.error("propertyList: %s" % str(propertyList))
    if not typeInstance:
        raise ValueError("typeInstance is null")
    if parent and not parentField:
        raise ValueError("parent is specified but parentField is not")
    if parent and parentField:
        configuration = parent.typeID.getSubInstance(terms.configuration)
        fieldObject = configuration.getFieldByReferenceValue(parentField.id)
        fieldData = fieldObject.getFieldData()
        if "objectAddRule" in fieldData and fieldData["objectAddRule"] == "_pick one":
            raise ValueError("instances can not be created in parents with a _pick one field")
                
    item = typeInstance.createEmptyInstance(parent, transactionState)

    # If the item being created is a user, then we have to set the primary administrator
    # of the user to itself so that the user has a primary administrator. Otherwise, we can't
    # add values to the user.
    if typeInstance==terms.user:
        if TermNames.primaryAdministrator not in propertyList:
            propertyList[TermNames.primaryAdministrator] = {"instanceID": item.id}
        # Add userID explicitly in case it isn't part of the configuration.
        userID = transactionState.user.id
        if isinstance(userID, uuid.UUID):
            userID = userID.hex    # SQLite
        item.addStringValue(terms[TermNames.userID], userID, 0, transactionState)
    elif parent:
        parent.checkWriteAccess(transactionState.user, parentField)
    else:
        if not transactionState.user.is_staff:
            raise RuntimeError("write permission failed")
        
    if parent:
        if position < 0:
            position = parent.getNextElementIndex(parentField)
        newIndex = parent.updateElementIndexes(parentField, position, transactionState)
        newValue = parent.addReferenceValue(parentField, item, newIndex, transactionState)
        item.parentValue = newValue
        item.save()
    else:
        newValue = None
        
    # Process the access records for this new item.
    if typeInstance.defaultCustomAccess:
        AccessRecord.objects.create(id=item, source=item)
    elif parent:
        try:
            parentAccessRecord = parent.accessrecord
            AccessRecord.objects.create(id=item, source=parentAccessRecord.source)
        except AccessRecord.DoesNotExist:
            pass

    if propertyList:
        if isinstance(propertyList, dict):
            if len(propertyList) > 0:
                configuration = typeInstance.getSubInstance(terms.configuration)
            
                # Handle security fields before all other fields so that children have the
                # correct security.
                for key in filter(lambda key: terms[key] in terms.securityFields, propertyList):
                    fieldData = configuration.getFieldDataByName(key) 
                    if fieldData:
                        _addElementData(item, propertyList[key], fieldData, nameLists, transactionState)
                
                for key in filter(lambda key: terms[key] not in terms.securityFields, propertyList):
                    fieldData = configuration.getFieldDataByName(key) 
                    if fieldData:
                        _addElementData(item, propertyList[key], fieldData, nameLists, transactionState)
        else:
            raise ValueError('initial data is not a dictionary: %s' % str(propertyList))
    
    item.cacheDescription(nameLists)    
    return (item, newValue)
                
# itemValues is a dictionary whose keys are the values to be found.
def createMissingInstances(parent, field, type, descriptor, itemValues, transactionState):
    items = {}

    # See if there is an field of parent which has a value that points to a name which has a value in items.
    vs = Value.objects.filter(field=descriptor, deleteTransaction__isnull=True)\
            .filter(instance__parent=parent)
            
    # See if there is an field of parent which has a value that points to a name which has a value in items.
    vs = Value.objects.filter(field=descriptor, deleteTransaction__isnull=True)\
            .filter(instance__parent=parent,instance__referenceValues__field=field)
            
    for v in vs:
        if v.stringValue in itemValues:
            items[v.stringValue] = v.instance
        elif v.referenceValue in itemValues:
            items[v.referenceValue] = v.instance
            
    position = parent.getNextElementIndex(field)
        
    nameLists = NameList()
    
    for s in itemValues:
        if not s in items:
            items[s] = create(type, parent, field, position, [], nameLists, transactionState)[0]
            position += 1
            items[s].addValue(descriptor, {"text": s}, 0, transactionState)
    
    return items
        
def addUniqueChild(parent, field, typeID, propertyList, nameList, transactionState):
    children = parent.value_set.filter(field=field,
                                    deleteTransaction__isnull=True)
    if len(children):
        return children[0].referenceValue
    else:
        item, newValue = create(typeID, parent, field, -1, propertyList, nameList, transactionState)
        return item

def addNamedChild(parent, field, type, nameField, fieldData, text, languageCode, nameList, transactionState):
    children = parent.getChildrenByName(field, nameField, text)
    if len(children):
        return children[0].referenceValue
    else:
        if fieldData['nameID'] != nameField.id:
            raise RuntimeError('Mismatch: %s/%s' % (fieldData['nameID'], nameField.id))
        if fieldData['dataType'] == '_translation':
            propertyList = {nameField.id: [{'text': text, 'languageCode': languageCode}]}
        else:
            propertyList = {nameField.id: [{'text': text}]}
        child, newValue = create(type, parent, field, -1, propertyList, nameList, transactionState)
        return child

def addNamedByReferenceChild(parent, field, type, nameField, fieldData, referenceValue, nameList, transactionState):
    children = parent.getChildrenByReferenceName(field, nameField, referenceValue)
    if len(children):
        return children[0].referenceValue
    else:
        if fieldData['nameID'] != nameField.id:
            raise RuntimeError('Mismatch: %s/%s' % (fieldData['nameID'], nameField.id))
        propertyList = {nameField.id: [{'instanceID': referenceValue.id}]}
        child, newValue = create(type, parent, field, -1, propertyList, nameList, transactionState)
        return child

