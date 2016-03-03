from django.conf import settings
from django.db import transaction, connection
from django.db.models import F, Q, Prefetch
from django.http import HttpResponse, JsonResponse, Http404
from django.shortcuts import render, redirect
from django.template import RequestContext, loader
from django.views.decorators.csrf import requires_csrf_token

from oauth2_provider.views.generic import ProtectedResourceView
from oauth2_provider.models import AccessToken

from pathlib import Path
import os
import json
import logging
import traceback
import uuid
import urllib.parse
import datetime
import itertools

from monitor.models import LogRecord
from custom_user import views as userviews
from consentrecords.models import *
from consentrecords import instancecreator
from consentrecords import pathparser
from consentrecords.userfactory import UserFactory

def home(request):
    LogRecord.emit(request.user, 'consentrecords/home', '')
    
    template = loader.get_template('consentrecords/userHome.html')
    args = {
        'user': request.user,
        'backURL': '/',
    }
    
    if request.user.is_authenticated():
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    state = request.GET.get('state', None)
    if state:
        args['state'] = state

    context = RequestContext(request, args)
        
    return HttpResponse(template.render(context))

def find(request, serviceid, offeringid):
    LogRecord.emit(request.user, 'consentrecords/find', '')
    
    template = loader.get_template('consentrecords/userHome.html')
    args = {
        'user': request.user,
        'backURL': '/',
    }
    
    if request.user.is_authenticated():
        args['userID'] = Instance.getUserInstance(request.user).id
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    args['state'] = "findNewExperience" + serviceid + offeringid
    
    if settings.FACEBOOK_SHOW:
        offering = Instance.objects.get(pk=offeringid)
        args['fbURL'] = request.build_absolute_uri()
        args['fbTitle'] = offering._description
        args['fbDescription'] = offering.parent and offering.parent.parent and offering.parent.parent._description

    context = RequestContext(request, args)
        
    return HttpResponse(template.render(context))

def list(request):
    LogRecord.emit(request.user, 'consentrecords/list', '')
    
    try:
        # The type of the root object.
        rootType = request.GET.get('type', None)
        root = rootType and Terms.getNamedInstance(rootType);
        path=request.GET.get('path', "_term")
        header=request.GET.get('header', "List")
            
        template = loader.get_template('consentrecords/configuration.html')
    
        argList = {
            'user': request.user,
            'canShowObjects': request.user.is_staff,
            'canAddObject': request.user.is_staff,
            'path': urllib.parse.unquote_plus(path),
            'header': header,
            }
        if root:
            argList["rootID"] = root.id
            argList["singularName"] = root._description
        
        context = RequestContext(request, argList)
        
        return HttpResponse(template.render(context))
    except Exception as e:
        return HttpResponse(str(e))

# Handle a POST event to create a new instance of an object with a set of properties.
class api:
    def createInstance(user, data):
        try:
            # The type of the new object.
            instanceType = data.get('typeName', None)
            instanceUUID = data.get('typeID', None)
            if instanceUUID:
                ofKindObject = Instance.objects.get(pk=instanceUUID)
            elif not instanceType:
                return JsonResponse({'success':False, 'error': "type was not specified in createInstance"})
            else:
                ofKindObject = Terms.getNamedInstance(instanceType)
        
            # An optional container for the new object.
            containerUUID = data.get('containerUUID', None)
        
            # The element name for the type of element that the new object is to the container object
            elementName = data.get('elementName', None)
            elementUUID = data.get('elementUUID', None)
            if elementUUID:
                field = Instance.objects.get(pk=elementUUID)
            elif elementName:
                field = Terms.getNamedInstance(elementName)
            elif instanceUUID:
                field = Instance.objects.get(pk=instanceUUID)
            elif instanceName: 
                field = Terms.getNamedInstance(instanceName)
            
            # An optional set of properties associated with the object.
            propertyString = data.get('properties', None)
            propertyList = json.loads(propertyString)
        
            indexString = data.get('index', "-1")
            index = int(indexString)
        
            # The client time zone offset, stored with the transaction.
            timezoneoffset = data['timezoneoffset']
            languageID = None
            language = None
            
            userInfo = UserInfo(user)
            
            with transaction.atomic():
                transactionState = TransactionState(user, timezoneoffset)
                if containerUUID:
                    containerObject = Instance.objects.get(pk=containerUUID)
                else:
                    containerObject = None

                nameLists = NameList()
                item, newValue = instancecreator.create(ofKindObject, containerObject, field, index, propertyList, nameLists, transactionState)
    
                if newValue and newValue.isDescriptor:
                    Instance.updateDescriptions([item], nameLists)
    
                if containerObject:
                    results = {'success':True, 'object': newValue.getReferenceData(userInfo, language)}
                else:    
                    results = {'success':True, 'object': item.getReferenceData(userInfo, language)}
            
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
            
        return JsonResponse(results)
        
    def updateValues(user, data):
        try:
            commandString = data.get('commands', "[]")
            commands = json.loads(commandString)
        
            # The client time zone offset, stored with the transaction.
            timezoneoffset = data['timezoneoffset']
        
            valueIDs = []
            instanceIDs = []
            nameLists = NameList()
            descriptionQueue = []
            
            with transaction.atomic():
                transactionState = TransactionState(user, timezoneoffset)
                for c in commands:
                    newInstance = None
                    if "id" in c:
                        oldValue = Value.objects.get(pk=c["id"],deleteTransaction__isnull=True)
                        oldValue.checkWriteAccess(user)

                        container = oldValue.instance

                        if oldValue.isDescriptor:
                            descriptionQueue.append(container)
                        if oldValue.hasNewValue(c):
                            container.checkWriteValueAccess(user, oldValue.field, c["instanceID"] if "instanceID" in c else None)
                            item = oldValue.updateValue(c, transactionState)
                        else:
                            oldValue.deepDelete(transactionState)
                            item = None
                    elif "containerUUID" in c:
                        container = Instance.objects.get(pk=c["containerUUID"],deleteTransaction__isnull=True)

                        field = Instance.objects.get(pk=c["fieldID"],deleteTransaction__isnull=True)
                        newIndex = c["index"]
                        instanceID = c["instanceID"] if "instanceID" in c else None

                        container.checkWriteValueAccess(user, field, instanceID)

                        if "ofKindID" in c:
                            ofKindObject = Instance.objects.get(pk=c["ofKindID"],deleteTransaction__isnull=True)
                            propertyList = newValue
                            newInstance, item = instancecreator.create(ofKindObject, container, field, newIndex, c, nameLists, transactionState)
                        else:
                            item = container.addValue(field, c, newIndex, transactionState)
                        if item.isDescriptor:
                            descriptionQueue.append(container)
                    else:
                        raise ValueError("subject id was not specified")
                    valueIDs.append(item.id if item else None)
                    instanceIDs.append(newInstance.id if newInstance else None)
                                
                Instance.updateDescriptions(descriptionQueue, nameLists)
                
                results = {'success':True, 'valueIDs': valueIDs, 'instanceIDs': instanceIDs}
            
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
               
        return JsonResponse(results)

    def addValue(user, data):
        try:
            # The path to the container object.
            containerPath = data.get('path', None)
        
            # The field name for the new value within the container object
            fieldName = data.get('fieldName', None)
        
            if fieldName is None:
                return JsonResponse({'success':False, 'error': 'the fieldName was not specified'})
            elif Terms.isUUID(fieldName):
                field = Instance.objects.get(pk=fieldName, deleteTransaction__isnull=True)
            else:
                field = Terms.getNamedInstance(fieldName)
            
            # A value added to the container.
            valueUUID = data.get('valueUUID', None)
        
            if valueUUID is None:
                return JsonResponse({'success':False, 'error': 'the value was not specified'})
            
            referenceValue = Instance.objects.get(pk=valueUUID)
            
            # The index of the value within the container.
            indexString = data.get('index', None)
        
            # The client time zone offset, stored with the transaction.
            timezoneoffset = data['timezoneoffset']
        
            with transaction.atomic():
                transactionState = TransactionState(user, timezoneoffset)
                
                if containerPath:
                    userInfo = UserInfo(user)
                    containers = pathparser.selectAllObjects(containerPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
                    if len(containers) > 0:
                        container = containers[0]
                    else:
                        raise RuntimeError("Specified path is not recognized")
                else:
                    raise RuntimeError("the container path was not specified")
                container.checkWriteValueAccess(user, field, valueUUID)
    
                if indexString:
                    newIndex = container.updateElementIndexes(field, int(indexString), transactionState)
                else:
                    newIndex = container.getNextElementIndex(field)
    
                item = container.addReferenceValue(field, referenceValue, newIndex, transactionState)
                if item.isDescriptor:
                    Instance.updateDescriptions([container], NameList())
                    
            results = {'success':True, 'id': item.id}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
            
        return JsonResponse(results)
        
    def selectAll(user, data):
        try:
            path = data.get("path", None)
            start = int(data.get("start", "0"))
            end = int(data.get("end", "0"))
            userInfo = UserInfo(user)
            language=None
        
            if not path:
                raise ValueError("path was not specified")
        
            uuObjects = pathparser.selectAllObjects(path, userInfo=userInfo, securityFilter=userInfo.findFilter)\
                            .select_related('description')\
                            .order_by('description__text', 'id')
            
            if end > 0:
                uuObjects = uuObjects[start:end]
            elif start > 0:
                uuObjects = uuObjects[start:]
            
            p = [i.getReferenceData(userInfo, language) for i in uuObjects]                                                
            results = {'success':True, 'objects': p}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
        
        return JsonResponse(results)
    
    # getValues is used to test whether or not a particular value exists in a field of any
    # instance with the specified path.    
    def getValues(user, data):
        try:
            path = data.get("path", None)
            if not path:
                return JsonResponse({'success':False, 'error': 'the path was not specified'})
                
            userInfo = UserInfo(user)
            language=None
        
            # The element name for the type of element that the new value is to the container object
            fieldName = data.get('fieldName', None)
        
            if fieldName is None:
                return JsonResponse({'success':False, 'error': 'the fieldName was not specified'})
            elif Terms.isUUID(fieldName):
                field = Instance.objects.get(pk=fieldName, deleteTransaction__isnull=True)
            else:
                field = Terms.getNamedInstance(fieldName)
            
            # A value with the container.
            value = data.get('value', None)
        
            if value is None:
                return JsonResponse({'success':False, 'error': 'the value was not specified'})
            
            containers = pathparser.selectAllObjects(path=path, userInfo=userInfo, securityFilter=userInfo.findFilter)
            m = map(lambda i: i.findValues(field, value), containers)
            p = map(lambda v: v.getReferenceData(userInfo, language=language), itertools.chain.from_iterable(m))
                            
            results = {'success':True, 'objects': [i for i in p]}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
        
        return JsonResponse(results)
        
    def getConfiguration(user, data):
        try:
            # Get the uuid for the configuration.
            typeName = data.get('typeName', None)
            typeUUID = data.get('typeID', None)
            if typeUUID:
                kindObject = Instance.objects.get(pk=typeUUID)
            elif typeName:
                kindObject = Terms.getNamedInstance(typeName)
            else:
                return JsonResponse({'success':False, 'error': "typeName was not specified in getAddConfiguration"})
        
            configurationObject = kindObject.getSubInstance(Terms.configuration)
        
            if not configurationObject:
                return JsonResponse({'success':False, 'error': "objects of this kind have no configuration object"})
                
            p = configurationObject.getConfiguration()
        
            results = {'success':True, 'cells': p}
        except Instance.DoesNotExist:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            return JsonResponse({'success':False, 'error': "the specified instanceType was not recognized"})
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
            
        return JsonResponse(results)

    def getUserID(user, data):
        accessTokenID = data.get('access_token', None)
    
        try:
            if not accessTokenID:
                raise ValueError("the access token is not specified")
            accessToken = AccessToken.objects.get(token=accessTokenID)
        
            userID = Instance.getUserInstance(accessToken.user).id
            results = {'success':True, 'userID': userID}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
            
        return JsonResponse(results)
    
    def _getCells(uuObject, fields, fieldsDataDictionary, language, userInfo):
        fieldsData = uuObject.typeID.getFieldsData(fieldsDataDictionary, language)
        
        vs = uuObject.values
            
        cells = uuObject.getData(vs, fieldsData, userInfo, language)
    
        data = {"id": None,
                'instanceID': uuObject.id, 
                'description': uuObject.getDescription(language),
                'parentID': uuObject.parent and uuObject.parent.id, 
                "cells" : cells }
        privilege = uuObject.getPrivilege(userInfo)
        if privilege:
            data['privilege'] = privilege.getDescription()
    
        if 'parents' in fields:
            while uuObject.parent:
                uuObject = Instance.objects\
                                .select_related('typeID')\
                                .select_related('parent')\
                                .select_related('description')\
                                .select_related('typeID__description')\
                                .get(pk=uuObject.parent.id)
                                
                kindObject = uuObject.typeID
                fieldData = kindObject.getParentReferenceFieldData()
            
                parentData = {'id': None, 
                              'instanceID' : uuObject.id,
                              'description': uuObject.getDescription(language),
                              'position': 0}
                privilege = uuObject.getPrivilege(userInfo)
                if privilege:
                    parentData['privilege'] = privilege.getDescription()
                data["cells"].append({"field": fieldData, "data": parentData})
        
        if TermNames.systemAccess in fields:
            if userInfo.authUser.is_superuser:
                uuObject = Terms.administerPrivilegeEnum
            elif userINfo.authUser.is_staff:
                uuObject = Terms.writePrivilegeEnum
            else:
                uuObject = None
            if uuObject:
                fieldData = Terms.systemAccess.getParentReferenceFieldData()
                parentData = {'id': None, 
                              'instanceID' : uuObject.id,
                              'description': uuObject.getDescription(language),
                              'position': 0,
                              'privilege': uuObject.description.text}
                data["cells"].append({"field": fieldData, "data": parentData})
            
        return data;
        
    def getData(user, data):
        pathparser.currentTimestamp = datetime.datetime.now()
        try:
            path = data.get('path', None)
            start = int(data.get("start", "0"))
            end = int(data.get("end", "0"))
        
            if not path:
                return JsonResponse({'success':False, 'error': "path was not specified in getData"})
            
            fieldString = data.get('fields', "[]")
            fields = json.loads(fieldString)
            
            language = data.get('language', None)

            userInfo=UserInfo(user)
            uuObjects = pathparser.selectAllObjects(path=path, userInfo=userInfo, securityFilter=userInfo.readFilter)
            fieldsDataDictionary = {}
            nameLists = NameList()
            
            # preload the typeID, parent, value_set and description to improve performance.
            valueQueryset = userInfo.findValueFilter(Value.objects.filter(deleteTransaction__isnull=True))\
                .order_by('position')\
                .select_related('field')\
                .select_related('field__id')\
                .select_related('referenceValue')\
                .select_related('referenceValue__description')

            uuObjects = uuObjects.select_related('typeID').select_related('parent')\
                                 .select_related('description')\
                                 .prefetch_related(Prefetch('value_set',
                                                            queryset=valueQueryset,
                                                            to_attr='values'))
            
            uuObjects = uuObjects.order_by('description__text', 'id');
            if end > 0:
                uuObjects = uuObjects[start:end]
            elif start > 0:
                uuObjects = uuObjects[start:]
                                                            
            p = [api._getCells(uuObject, fields, fieldsDataDictionary, language, userInfo) for uuObject in uuObjects]        
        
            results = {'success':True, 'data': p}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            logger.error("getData data:%s" % str(data))
            
            results = {'success':False, 'error': str(e)}
        
        return JsonResponse(results)
    
    def _getValueData(v, fieldsDataDictionary, language, userInfo):
        fieldsData = v.referenceValue.typeID.getFieldsData(fieldsDataDictionary, language)
        data = v.getReferenceData(userInfo, language)
        vs = userInfo.findValueFilter(v.referenceValue.value_set.filter(deleteTransaction__isnull=True))\
            .order_by('position')\
            .select_related('field')\
            .select_related('field__id')\
            .select_related('referenceValue')\
            .select_related('referenceValue__description')
        data["cells"] = v.referenceValue.getData(vs, fieldsData, userInfo, language)
        return data;
    
    def getCellData(user, data):
        pathparser.currentTimestamp = datetime.datetime.now()
        try:
            path = data.get('path', None)
        
            if not path:
                return JsonResponse({'success':False, 'error': "path was not specified in getData"})
            
            # The field name for the values to find within the container object
            fieldName = data.get('fieldName', None)
        
            if fieldName is None:
                return JsonResponse({'success':False, 'error': 'the fieldName was not specified'})
            elif Terms.isUUID(fieldName):
                field = Instance.objects.get(pk=fieldName, deleteTransaction__isnull=True)
            else:
                field = Terms.getNamedInstance(fieldName)
                
            language = data.get('language', None)

            userInfo=UserInfo(user)
            uuObjects = pathparser.selectAllObjects(path=path, userInfo=userInfo, securityFilter=userInfo.readFilter)
            values = uuObjects[0].getReadableSubValues(field, userInfo)
            fieldsDataDictionary = {}
            p = [api._getValueData(v, fieldsDataDictionary, language, userInfo) for v in values]        
        
            results = {'success':True, 'objects': p}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            logger.error("getData data:%s" % str(data))
            
            results = {'success':False, 'error': str(e)}
        
        return JsonResponse(results)
    
    # This should only be done for root instances. Otherwise, the value should
    # be deleted, which will delete this as well.
    def deleteInstances(user, data):
        try:
            path = data.get('path', None)
        
            if path:
                # The client time zone offset, stored with the transaction.
                timezoneoffset = data['timezoneoffset']
        
                with transaction.atomic():
                    transactionState = TransactionState(user, timezoneoffset)
                    descriptionCache = []
                    nameLists = NameList()
                    userInfo=UserInfo(user)
                    for uuObject in pathparser.selectAllObjects(path, userInfo=userInfo, securityFilter=userInfo.administerFilter):
                        if uuObject.parent:
                            raise RuntimeError("can only delete root instances directly")
                        uuObject.deleteOriginalReference(transactionState)
                        uuObject.deepDelete(transactionState)
            else:   
                return JsonResponse({'success':False, 'error': "path was not specified in delete"})
            results = {'success':True}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
            
        return JsonResponse(results)
        
    def deleteValue(user, data):
        try:
            valueID = data.get('valueID', None)
        
            if valueID:
                v = Value.objects.get(pk=valueID, deleteTransaction__isnull=True)

                # The client time zone offset, stored with the transaction.
                timezoneoffset = data['timezoneoffset']

                with transaction.atomic():
                    v.checkWriteAccess(user)
                    
                    transactionState = TransactionState(user, timezoneoffset)
                    v.deepDelete(transactionState)
                    
                    if v.isDescriptor:
                        nameLists = NameList()
                        Instance.updateDescriptions([v.instance], nameLists)
            else:   
                return JsonResponse({'success':False, 'error': "valueID was not specified in delete"})
            results = {'success':True}
        except Value.DoesNotExist:
            return JsonResponse({'success':False, 'error': "the specified value ID was not recognized"})
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
            
        return JsonResponse(results)

def createInstance(request):
    if request.method != "POST":
        raise Http404("createInstance only responds to POST methods")
    
    if not request.user.is_authenticated():
        return JsonResponse({'success':False, 'error': 'the current user is not authenticated'})
    
    return api.createInstance(request.user, request.POST)
    
def updateValues(request):
    if request.method != "POST":
        raise Http404("updateValues only responds to POST methods")
    
    if not request.user.is_authenticated():
        return JsonResponse({'success':False, 'error': 'the current user is not authenticated'})
    
    return api.updateValues(request.user, request.POST)
    
# Handle a POST event to add a value to an object that references another other or data.
def addValue(request):
    if request.method != "POST":
        raise Http404("addValue only responds to POST methods")
    
    if not request.user.is_authenticated():
        return JsonResponse({'success':False, 'error': 'the current user is not authenticated'})
    
    return api.addValue(request.user, request.POST)
        
def deleteInstances(request):
    if request.method != "POST":
        raise Http404("deleteInstances only responds to POST methods")
    
    if not request.user.is_authenticated():
        return JsonResponse({'success':False, 'error': 'the current user is not authenticated'})
        
    return api.deleteInstances(request.user, request.POST)
    
def deleteValue(request):
    if request.method != "POST":
        raise Http404("deleteValue only responds to POST methods")
    
    if not request.user.is_authenticated():
        return JsonResponse({'success':False, 'error': 'the current user is not authenticated'})
    
    return api.deleteValue(request.user, request.POST)
    
def selectAll(request):
    if request.method != "GET":
        raise Http404("selectAll only responds to GET methods")
    
    return api.selectAll(request.user, request.GET)
    
def getValues(request):
    if request.method != "GET":
        raise Http404("getValues only responds to GET methods")
    
    return api.getValues(request.user, request.GET)
    
def getConfiguration(request):
    if request.method != "GET":
        raise Http404("getConfiguration only responds to GET methods")
    
    return api.getConfiguration(request.user, request.GET)
    
def getUserID(request):
    if request.method != "GET":
        raise Http404("getUserID only responds to GET methods")
    
    return api.getUserID(request.user, request.GET)

def getData(request):
    if request.method != "GET":
        raise Http404("getData only responds to GET methods")
    
    return api.getData(request.user, request.GET)

def getCellData(request):
    if request.method != "GET":
        raise Http404("getCellData only responds to GET methods")
    
    return api.getCellData(request.user, request.GET)

class ApiEndpoint(ProtectedResourceView):
    def get(self, request, *args, **kwargs):
        if request.path_info == '/api/getdata/':
            return getData(request)
        if request.path_info == '/api/getcelldata/':
            return getCellData(request)
        elif request.path_info == '/api/getconfiguration/':
            return getConfiguration(request)
        elif request.path_info == '/api/selectall/':
            return selectAll(request)
        elif request.path_info == '/api/getvalues/':
            return getValues(request)
        return JsonResponse({'success':False, 'error': 'unrecognized url'})
        
    def post(self, request, *args, **kwargs):
        if request.path_info == '/api/createinstance/':
            return createInstance(request)
        elif request.path_info == '/api/updatevalues/':
            return updateValues(request)
        elif request.path_info == '/api/addvalue/':
            return addValue(request)
        elif request.path_info == '/api/deleteinstances/':
            return deleteInstances(request)
        elif request.path_info == '/api/deletevalues/':
            return deleteValues(request)
        return JsonResponse({'success':False, 'error': 'unrecognized url'})
    
class ApiGetUserIDEndpoint(ProtectedResourceView):
    def get(self, request, *args, **kwargs):
        return getUserID(request)
        
# Handles a post operation that contains the users username (email address) and password.
def submitsignin(request):
    if request.method != "POST":
        raise Http404("submitsignin only responds to POST methods")
    
    try:
        timezoneOffset = request.POST["timezoneoffset"]
    
        results = userviews.signinResults(request)
        if results["success"]:
            user = Instance.getUserInstance(request.user) or UserFactory.createUserInstance(request.user, None, timezoneOffset)
            results["user"] = { "instanceID": user.id, "description" : user.getDescription(None) }        
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
        
    return JsonResponse(results)

def submitNewUser(request):
    if request.method != "POST":
        raise Http404("submitNewUser only responds to POST methods")
    
    try:
        timezoneOffset = request.POST["timezoneoffset"]
    
        # An optional set of properties associated with the object.
        propertyString = request.POST.get('properties', "")
        propertyList = json.loads(propertyString)
    
        with transaction.atomic():
            results = userviews.newUserResults(request)
            if results["success"]:
                userInstance = Instance.getUserInstance(request.user) or UserFactory.createUserInstance(request.user, propertyList, timezoneOffset)
                results["user"] = { "instanceID": userInstance.id, "description" : userInstance.getDescription(None) }
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
        
    return JsonResponse(results)

def updateUsername(request):
    if request.method != "POST":
        raise Http404("updateUsername only responds to POST methods")
    
    try:
        timezoneOffset = request.POST["timezoneoffset"]
    
        with transaction.atomic():
            results = userviews.updateUsernameResults(request)
            if results["success"]:
                userInstance = Instance.getUserInstance(request.user)
                transactionState = TransactionState(request.user, timezoneOffset)
                v = userInstance.getSubValue(Terms.email)
                v.updateValue(request.user.email, transactionState)
                nameLists = NameList()
                userInstance.cacheDescription(nameLists);
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
        
    return JsonResponse(results)

def features(request):
    template = loader.get_template('doc/features.html')
    context = RequestContext(request, {
    })
        
    return HttpResponse(template.render(context))

