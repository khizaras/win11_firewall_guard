import sys
from pathlib import Path
from PySide6.QtWidgets import QApplication
from ui.main_window import MainWindow
if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setApplicationName("Windows Firewall Guard Pro")
    app.setStyle("Fusion")
    window = MainWindow(Path(__file__).resolve().parent)
    window.show()
    sys.exit(app.exec())
