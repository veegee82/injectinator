from btm import chat, list_models, new_conversation

print("Models:", list_models())

conv = new_conversation()
print(chat("Hi! What are your visiting hours?",
           model="Qwen/Qwen3-30B-A3B-Instruct-2507",   # weakest model - start here
           conversation_id=conv))
import btm; print("turn_id:", btm.LAST_TURN_ID)
