from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render, redirect
from django.template import RequestContext, loader

from pathlib import Path
import os
import json

def home(request):
    s = os.path.dirname(__file__)
    p = Path(settings.STATIC_ROOT)
    children = []
    for child in p.iterdir():
        children.append(child)

    template = loader.get_template('consentrecords/home.html')
    context = RequestContext(request, {
        'staticRoot': settings.STATIC_ROOT,
        'children': children,
    })
        
    return HttpResponse(template.render(context))


