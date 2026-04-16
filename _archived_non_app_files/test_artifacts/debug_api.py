import json
import os
import requests

API = "http://165.232.182.130/api/v1"

def get_firebase_api_key():
    gs = os.path.join("nearshop-mobile", "android", "app", "google-services.json")
    if not os.path.exists(gs): return None
    with open(gs, "r", encoding="utf-8") as f:
        data = json.load(f)
    for c in data.get("client", []):
        for k in c.get("api_key", []):
            if k.get("current_key"): return k["current_key"]
    return None

def test_firebase_only(email):
    api_key = get_firebase_api_key()
    print(f"Testing Firebase Auth for {email}...")
    fb = requests.post(f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}",
                       json={"email": email, "password": "123456", "returnSecureToken": True}, timeout=30)
    print(f"Firebase Status: {fb.status_code}")
    if fb.status_code == 200:
        print("Firebase Sign-in SUCCESS")
    else:
        print(f"Firebase Sign-in FAILED: {fb.text}")

print(f"Testing API root {API}...")
try:
    r = requests.get(API, timeout=10)
    print(f"API Root Status: {r.status_code}")
except Exception as e:
    print(f"API Root connection failed: {e}")

test_firebase_only("naveen.kumar3610+2@gmail.com")
