
from app.routers.recommendation import _topological_sort


def assert_prerequisites_come_first(rows):
    """Validate prerequisite ordering without assuming a particular subject."""
    ordered = _topological_sort(rows, raise_on_cycle=True)
    positions = {node["id"]: i for i, node in enumerate(ordered)}

    for node in rows:
        for prerequisite_id in node.get("dependsOn", []):
            if prerequisite_id in positions:
                assert positions[prerequisite_id] < positions[node["id"]], (
                    f"{prerequisite_id} must come before {node['id']}"
                )

    return ordered


def test_dsa_graph_orders_prerequisites_before_dependent_concepts():
    graph = [
        {
            "id": "dsa.binary_search",
            "label": "Binary Search",
            "dependsOn": ["dsa.sorted_arrays"],
        },
        {
            "id": "dsa.arrays",
            "label": "Arrays",
            "dependsOn": [],
        },
        {
            "id": "dsa.sorted_arrays",
            "label": "Sorted Arrays",
            "dependsOn": ["dsa.arrays"],
        },
    ]

    ordered = assert_prerequisites_come_first(graph)
    ids = [node["id"] for node in ordered]

    assert ids.index("dsa.arrays") < ids.index("dsa.sorted_arrays")
    assert ids.index("dsa.sorted_arrays") < ids.index("dsa.binary_search")


def test_computer_networks_graph_orders_prerequisites_before_dependents():
    graph = [
        {
            "id": "networks.tcp",
            "label": "TCP",
            "dependsOn": ["networks.transport_layer"],
        },
        {
            "id": "networks.osi_model",
            "label": "OSI Model",
            "dependsOn": [],
        },
        {
            "id": "networks.transport_layer",
            "label": "Transport Layer",
            "dependsOn": ["networks.osi_model"],
        },
    ]

    ordered = assert_prerequisites_come_first(graph)
    ids = [node["id"] for node in ordered]

    assert ids.index("networks.osi_model") < ids.index(
        "networks.transport_layer"
    )
    assert ids.index("networks.transport_layer") < ids.index("networks.tcp")


def test_independent_concepts_are_supported_across_subjects():
    graph = [
        {
            "id": "math.matrices",
            "label": "Matrices",
            "dependsOn": [],
        },
        {
            "id": "os.processes",
            "label": "Processes",
            "dependsOn": [],
        },
    ]

    ordered = assert_prerequisites_come_first(graph)

    assert {node["id"] for node in ordered} == {
        "math.matrices",
        "os.processes",
    }
