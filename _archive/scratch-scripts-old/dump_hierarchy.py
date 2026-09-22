import json
import sys

def dump_children(filename, target_id):
    with open(filename, "r", encoding="utf-8") as f:
        tree = json.load(f)
    
    def find_node(nodes, tid):
        for node in nodes:
            if node["id"] == tid:
                return node
            if "children" in node:
                found = find_node(node["children"], tid)
                if found: return found
        return None

    node = find_node(tree, target_id)
    if node:
        print(f"Node: {node['name']} ({node['id']})")
        for child in node.get("children", []):
            print(f"  - {child['name']} ({child['id']})")
    else:
        print("Node not found")

print("--- JUMBO LIMPIEZA ---")
dump_children("jumbo_categories.json", 13)
print("\n--- DIA LIMPIEZA ---")
dump_children("dia_categories.json", 282)
