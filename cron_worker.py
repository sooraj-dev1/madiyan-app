import os
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone
import firebase_admin
from firebase_admin import credentials, firestore, messaging

# 1. Firebase Admin SDK initialize cheyyunnu
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# Sarcastic Manglish Roasts Database
ROASTS = {
    "salim": [
        "Eda dooshya... Task time kazhinju! Ini entha justification?",
        "Pora... ninte oru ithu pora! Alpam engilum uluppu baki undo?",
        "Vicharichaal nadakkilla ennu ariyam, ennalum oru reminder thannathaanu!"
    ],
    "amma": [
        "Phone scroll cheythu theerkkane munpu aa task theerku!",
        "Baki ullavar ee samayath kond ethra karyangal theerkkunnu!",
        "Padichitt karyamilla, oru karyavum samayathu cheyyilla!"
    ],
    "chank": [
        "Aliyaaa... Scene aakum! Poyi aa task cheyyeda!",
        "Ithrem valiya tholvi njaan swapnathil polum kandittilla!",
        "5 minutes koodi snooze cheythu ivide aarum Ambani aayittilla!"
    ]
}

def check_and_send_due_notifications():
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        tasks_ref = db.collection("tasks")
        due_tasks = tasks_ref.where(filter=firestore.FieldFilter("completed", "==", False)).stream()

        for doc in due_tasks:
            task = doc.to_dict()

            if not task.get("notified", False) and task.get("time", "") <= now_iso:
                token = task.get("deviceToken")

                if token:
                    persona = task.get("persona", "chank")
                    roast_list = ROASTS.get(persona, ROASTS["chank"])
                    roast_msg = roast_list[0]
                    task_title = task.get("title", "Task")

                    message = messaging.Message(
                        notification=messaging.Notification(
                            title=f"⏰ {task_title}",
                            body=roast_msg
                        ),
                        data={
                            "taskId": str(doc.id),
                            "title": f"⏰ {task_title}",
                            "body": roast_msg
                        },
                        webpush=messaging.WebpushConfig(
                            headers={"Urgency": "high"},
                            notification=messaging.WebpushNotification(
                                title=f"⏰ {task_title}",
                                body=roast_msg,
                                icon="https://cdn-icons-png.flaticon.com/512/3239/3239958.png",
                                sound="default"
                            )
                        ),
                        token=token
                    )

                    try:
                        messaging.send(message)
                        db.collection("tasks").document(doc.id).update({"notified": True})
                        print(f"🔥 [SUCCESS] Notification sent for: {task_title}")
                    except Exception as e:
                        print(f"⚠️ [FCM Send Error]: {e}")
                else:
                    print(f"ℹ️ Task '{task.get('title')}' has no deviceToken saved yet.")

    except Exception as e:
        print(f"❌ Error querying Firestore: {e}")

# Render Web Service port bind cheyyaan ulla tiny dummy server
class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Madiyan Cron Worker is Active and Running 24/7!")

def start_health_server():
    port = int(os.environ.get("PORT", 8080))
    server = HTTPServer(("0.0.0.0", port), HealthCheckHandler)
    print(f"🌐 Health server running on port {port}")
    server.serve_forever()

if __name__ == "__main__":
    print("🚀 Madiyan Background Cron Worker is STARTING...")
    
    # Render-nte port issue fix cheyyaan server-ne background thread-il run aakkunnu
    threading.Thread(target=start_health_server, daemon=True).start()

    print("👀 Listening for due tasks every 10 seconds...")
    while True:
        check_and_send_due_notifications()
        time.sleep(10)