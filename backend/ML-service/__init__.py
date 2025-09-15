# __init__.py

# This file is an essential part of Python's module system.
# Its purpose is to declare the `ml_service` directory as a Python package.

# Why is this important?
# Without this file, a Python script (like `app.py`) would not be able to find
# and import other Python files (like `process.py`) inside this directory.

# For this project, this file is intentionally left empty.
# Its very existence is enough to serve its purpose of enabling the
# following import statement in your `app.py` file:
#
#    from ml_service.process import get_stress_score
#
# This allows for a clean separation of concerns, keeping your Flask
# application logic separate from your core machine learning code.
