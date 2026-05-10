import asyncio
from aiogram import Bot, Dispatcher, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

BOT_TOKEN = "BOT_TOKENNI_SHU_YERGA_YOZING"
ADMIN_ID = 123456789  # O'z ID raqamingizni yozing

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# --- VAQTINCHALIK BAZA (Loyihangizdagi bazaga ulaysiz) ---
db = {
    "platforms": ["1xbet", "Linebet"], # 1. Platformalar qo'shilgan
    "channels": [],                    # Majburiy kanallar ro'yxati
    "guide_video": None,               # 2. Video uchun joy
    "guide_text": "Hozircha qo'llanma yo'q."
}

# --- HOLATLAR (States) ---
class AdminStates(StatesGroup):
    waiting_for_guide = State()
    waiting_for_channel_add = State()
    waiting_for_channel_del = State()
    waiting_for_signal_platform = State()

# --- ASOSIY ADMIN MENYU ---
def admin_menu():
    kb = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📊 Signal tahrirlash")],
            [KeyboardButton(text="📚 Qo'llanmalar"), KeyboardButton(text="📢 Kanallar")] # 3. Sozlamalar -> Kanallar
        ],
        resize_keyboard=True
    )
    return kb

# --- ADMIN PANELGA KIRISH ---
@dp.message(F.text == "/admin")
async def start_admin(message: Message):
    if message.from_user.id == ADMIN_ID:
        await message.answer("Admin panelga xush kelibsiz!", reply_markup=admin_menu())

# ==========================================
# 1. SIGNAL TAHRIRLASH VA PLATFORMALAR
# ==========================================
@dp.message(F.text == "📊 Signal tahrirlash")
async def edit_signals(message: Message):
    if message.from_user.id != ADMIN_ID: return
    
    # Platformalar ro'yxatini chiqarish
    buttons = []
    for plat in db["platforms"]:
        buttons.append([InlineKeyboardButton(text=plat, callback_data=f"plat_{plat}")])
    buttons.append([InlineKeyboardButton(text="➕ Yangi platforma qo'shish", callback_data="add_platform")])
    
    kb = InlineKeyboardMarkup(inline_keyboard=buttons)
    await message.answer("Tahrirlash uchun platformani tanlang:", reply_markup=kb)

# ==========================================
# 2. QO'LLANMALAR (VIDEO VA MATN)
# ==========================================
@dp.message(F.text == "📚 Qo'llanmalar")
async def edit_guides(message: Message, state: FSMContext):
    if message.from_user.id != ADMIN_ID: return
    
    await message.answer(
        "Yangi qo'llanmani yuboring.\n"
        "Video yuborayotganda, tagiga matnini (caption) ham yozib yuboring."
    )
    await state.set_state(AdminStates.waiting_for_guide)

@dp.message(AdminStates.waiting_for_guide)
async def save_guide(message: Message, state: FSMContext):
    if message.video:
        # Video va uning ostidagi matnni saqlash
        db["guide_video"] = message.video.file_id
        db["guide_text"] = message.caption if message.caption else "Qo'llanma matni"
        await message.answer("✅ Video qo'llanma muvaffaqiyatli saqlandi!")
    elif message.text:
        # Faqat matn bo'lsa
        db["guide_video"] = None
        db["guide_text"] = message.text
        await message.answer("✅ Matnli qo'llanma saqlandi! (Video biriktirilmadi)")
    else:
        await message.answer("Iltimos, video yoki matn yuboring.")
        return
    
    await state.clear()

# Foydalanuvchilar qo'llanmani ko'rishi uchun namuna (Test uchun)
@dp.message(F.text == "/guide")
async def show_guide(message: Message):
    if db["guide_video"]:
        await message.answer_video(video=db["guide_video"], caption=db["guide_text"])
    else:
        await message.answer(db["guide_text"])

# ==========================================
# 3. KANALLAR (MAJBURIY KANALLARNI O'CHIRISH VA QO'SHISH)
# ==========================================
@dp.message(F.text == "📢 Kanallar")
async def manage_channels(message: Message):
    if message.from_user.id != ADMIN_ID: return
    
    # Kanallar menyusi
    buttons = [
        [InlineKeyboardButton(text="➕ Kanal qo'shish", callback_data="add_channel")],
        [InlineKeyboardButton(text="🗑 Kanalni o'chirish", callback_data="del_channel")]
    ]
    kb = InlineKeyboardMarkup(inline_keyboard=buttons)
    
    text = "Majburiy kanallar ro'yxati:\n"
    if not db["channels"]:
        text += "Hozircha kanallar yo'q."
    else:
        for i, ch in enumerate(db["channels"], 1):
            text += f"{i}. {ch}\n"
            
    await message.answer(text, reply_markup=kb)

# Kanal qo'shish jarayoni
@dp.callback_query(F.data == "add_channel")
async def add_channel_prompt(call: CallbackQuery, state: FSMContext):
    await call.message.answer("Qo'shmoqchi bo'lgan kanalning ID si yoki Usernameni yozing (masalan: @mening_kanalim):")
    await state.set_state(AdminStates.waiting_for_channel_add)
    await call.answer()

@dp.message(AdminStates.waiting_for_channel_add)
async def save_new_channel(message: Message, state: FSMContext):
    db["channels"].append(message.text)
    await message.answer(f"✅ Kanal qo'shildi: {message.text}")
    await state.clear()

# Kanal o'chirish jarayoni
@dp.callback_query(F.data == "del_channel")
async def del_channel_prompt(call: CallbackQuery, state: FSMContext):
    if not db["channels"]:
        await call.message.answer("O'chirish uchun kanallar yo'q.")
        await call.answer()
        return
        
    buttons = []
    for ch in db["channels"]:
        buttons.append([InlineKeyboardButton(text=f"❌ {ch}", callback_data=f"remove_{ch}")])
        
    kb = InlineKeyboardMarkup(inline_keyboard=buttons)
    await call.message.answer("O'chirmoqchi bo'lgan kanalni tanlang:", reply_markup=kb)
    await call.answer()

@dp.callback_query(F.data.startswith("remove_"))
async def process_del_channel(call: CallbackQuery):
    channel_to_remove = call.data.replace("remove_", "")
    if channel_to_remove in db["channels"]:
        db["channels"].remove(channel_to_remove)
        await call.message.edit_text(f"✅ Kanal o'chirildi: {channel_to_remove}")
    await call.answer()

# --- BOTNI ISHGA TUSHIRISH ---
async def main():
    print("Bot ishga tushdi...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
