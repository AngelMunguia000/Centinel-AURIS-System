from centinela_gateway.adapters.cola import Cola


def test_cola_sobrevive_reinicio(tmp_path):
    ruta = str(tmp_path / "cola.db")
    Cola(ruta).encolar({"id": "e1", "tipo": "boton"})
    otra = Cola(ruta)
    assert [e["id"] for e in otra.pendientes()] == ["e1"]


def test_encolar_mismo_id_no_duplica(tmp_path):
    cola = Cola(str(tmp_path / "c.db"))
    cola.encolar({"id": "e1"})
    cola.encolar({"id": "e1"})
    assert len(cola.pendientes()) == 1


def test_confirmar_y_orden(tmp_path):
    cola = Cola(str(tmp_path / "c.db"))
    for i in range(3):
        cola.encolar({"id": f"e{i}"})
    assert [e["id"] for e in cola.pendientes(limite=2)] == ["e0", "e1"]
    cola.confirmar(["e0", "e1"])
    assert [e["id"] for e in cola.pendientes()] == ["e2"]
