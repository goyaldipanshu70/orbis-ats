"""Generic executor for user-defined custom node types."""
import logging
import asyncio
from typing import Any, Dict
from app.nodes.base import BaseNode

logger = logging.getLogger(__name__)

SAFE_BUILTINS = {
    'abs': abs, 'all': all, 'any': any, 'bool': bool,
    'dict': dict, 'enumerate': enumerate, 'filter': filter,
    'float': float, 'frozenset': frozenset, 'int': int,
    'isinstance': isinstance, 'len': len, 'list': list,
    'map': map, 'max': max, 'min': min, 'range': range,
    'reversed': reversed, 'round': round, 'set': set,
    'sorted': sorted, 'str': str, 'sum': sum, 'tuple': tuple,
    'type': type, 'zip': zip, 'print': print, 'None': None,
    'True': True, 'False': False, 'Exception': Exception,
    'ValueError': ValueError, 'TypeError': TypeError,
    'KeyError': KeyError, 'IndexError': IndexError,
}

ALLOWED_MODULES = {
    'json', 're', 'math', 'datetime', 'collections',
    'itertools', 'functools', 'urllib.parse', 'hashlib',
    'logging', 'asyncio', 'httpx',
}


def _safe_import(name, *args, **kwargs):
    if name not in ALLOWED_MODULES:
        raise ImportError(f"Import of '{name}' is not allowed in custom nodes. Allowed: {', '.join(sorted(ALLOWED_MODULES))}")
    return __import__(name, *args, **kwargs)


def create_custom_node_class(
    node_type: str,
    category: str,
    display_name: str,
    description: str,
    config_schema: dict,
    execution_code: str,
) -> type:
    wrapped_code = f"""
import json, re, math, datetime, collections, itertools, functools, hashlib, logging, asyncio
import httpx

async def _user_execute(self, input_data):
{chr(10).join('    ' + line for line in execution_code.splitlines())}
"""

    namespace = {'__builtins__': {**SAFE_BUILTINS, '__import__': _safe_import}}
    try:
        exec(compile(wrapped_code, f'<custom_node:{node_type}>', 'exec'), namespace)
    except SyntaxError as e:
        raise ValueError(f"Syntax error in custom node '{node_type}': {e}")

    user_execute = namespace['_user_execute']

    cls = type(f'CustomNode_{node_type}', (BaseNode,), {
        'node_type': node_type,
        'category': category,
        'display_name': display_name,
        'description': description,
        'config_schema': config_schema,
        'execute': user_execute,
    })

    return cls
