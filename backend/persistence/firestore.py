import os
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

# Load from the parent workspace directory
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'))

def init_firebase():
    if not firebase_admin._apps:
        private_key = os.getenv("FIREBASE_PRIVATE_KEY", "")
        # Handle literal \n if dotenv didn't parse them
        if "\\n" in private_key:
            private_key = private_key.replace("\\n", "\n")
            
        cert_dict = {
            "type": "service_account",
            "project_id": os.getenv("FIREBASE_PROJECT_ID"),
            "private_key": private_key,
            "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
            "token_uri": "https://oauth2.googleapis.com/token",
        }
        cred = credentials.Certificate(cert_dict)
        firebase_admin.initialize_app(cred)
    
    return firestore.client()

db = init_firebase()
