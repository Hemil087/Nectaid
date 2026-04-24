import json, os
import firebase_admin
from firebase_admin import credentials

def init_firebase_admin():
    if firebase_admin._apps:
        return firebase_admin.get_app()
    
    sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    sa_path = os.getenv("FIREBASE_SA")
    
    if sa_json:
        sa_json = sa_json.strip().strip("'\"")
        cred = credentials.Certificate(json.loads(sa_json))
    elif sa_path and os.path.exists(sa_path):
        cred = credentials.Certificate(sa_path)
    else:
        cred = credentials.ApplicationDefault()
    
    return firebase_admin.initialize_app(cred)