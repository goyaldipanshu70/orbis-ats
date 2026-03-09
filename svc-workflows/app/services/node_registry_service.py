from app.nodes import NODE_REGISTRY

# Aliases that exist only for backward-compat execution — hide from UI palette
_HIDDEN_ALIASES = {"google_search"}


def get_node_types():
    """Return metadata for all registered node types."""
    result = []
    for node_type, cls in NODE_REGISTRY.items():
        if node_type in _HIDDEN_ALIASES:
            continue
        result.append({
            "type": node_type,
            "category": cls.category,
            "display_name": cls.display_name,
            "description": cls.description,
            "config_schema": cls.config_schema,
        })
    return result
