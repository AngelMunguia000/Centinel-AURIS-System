import asyncio
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

import pytest

PUERTO_BROKER = 18830


@pytest.fixture(scope="session")
def event_loop_policy():
    # aiomqtt necesita add_reader/add_writer, que el loop Proactor de Windows no tiene.
    if sys.platform == "win32":
        return asyncio.WindowsSelectorEventLoopPolicy()
    return asyncio.DefaultEventLoopPolicy()


def _mosquitto() -> str:
    encontrado = shutil.which("mosquitto")
    if encontrado:
        return encontrado
    windows = Path(r"C:\Program Files\mosquitto\mosquitto.exe")
    if windows.exists():
        return str(windows)
    pytest.skip("Mosquitto no instalado: winget install EclipseFoundation.Mosquitto (o apt install mosquitto)")


@pytest.fixture(scope="session")
def broker():
    """Mosquitto real en un puerto propio: lo que se prueba es el broker que corre en la Pi."""
    proceso = subprocess.Popen([_mosquitto(), "-p", str(PUERTO_BROKER)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    limite = time.time() + 5
    while time.time() < limite:
        try:
            socket.create_connection(("127.0.0.1", PUERTO_BROKER), timeout=0.2).close()
            break
        except OSError:
            time.sleep(0.1)
    else:
        proceso.kill()
        pytest.fail("Mosquitto no arrancó en 5 s")
    yield ("127.0.0.1", PUERTO_BROKER)
    proceso.terminate()
    proceso.wait(timeout=5)
