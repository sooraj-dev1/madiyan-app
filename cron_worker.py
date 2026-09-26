import firebase_admin
from firebase_admin import credentials, firestore, messaging
from datetime import datetime
import time

# 1. Step 1-il download cheytha key load cheyyunnu
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# Sarcastic Manglish Roasts
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
    # Current UTC time string format-il
    now_iso = datetime.utcnow().isoformat()

    try:
        tasks_ref = db.collection("tasks")
        # Due aaya pending tasks thappunnu
        due_tasks = tasks_ref.where("completed", "==", False) \
                             .where("notified", "==", False) \
                             .where("time", "<=", now_iso) \
                             .stream()

        for doc in due_tasks:
            task = doc.to_dict()
            token = task.get("deviceToken")

            if token:
                persona = task.get("persona", "chank")
                roast_list = ROASTS.get(persona, ROASTS["chank"])
                roast_msg = roast_list[0]
                task_title = task.get("title", "Task")

                # Google FCM message structure
                message = messaging.Message(
                    notification=messaging.Notification(
                        title=f"⏰ {task_title}",
                        body=roast_msg
                    ),
                    data={
                        "taskId": doc.id,
                        "title": f"⏰ {task_title}",
                        "body": roast_msg
                    },
                    token=token
                )

                try:
                    messaging.send(message)
                    # Task notified aayi mark cheyyunnu so repeat aavilla
                    db.collection("tasks").document(doc.id).update({"notified": True})
                    print(f"🔥 [SUCCESS] Notification sent for: {task_title}")
                except Exception as e:
                    print(f"⚠️ [FCM Send Error]: {e}")
            else:
                print(f"ℹ️ Task '{task.get('title')}' has no deviceToken saved yet.")

    except Exception as e:
        print(f"❌ Error querying Firestore: {e}")

if __name__ == "__main__":
    print("🚀 Madiyan Background Cron Worker is RUNNING...")
    print("👀 Listening for due tasks every 10 seconds...")
    while True:
        check_and_send_due_notifications()
        time.sleep(10)