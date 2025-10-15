from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel
from transformers import AutoProcessor, AutoModelForImageTextToText
from transformers.image_utils import load_image
from typing import Optional
import torch
from io import BytesIO
from PIL import Image

# ==== モデル設定 ====
MODEL_PATH = "HayatoHongo/lfm2-vl-ja-finetuned-enmt1ep-jamt10eponall-vqa"

processor = AutoProcessor.from_pretrained(MODEL_PATH, trust_remote_code=True)
model = AutoModelForImageTextToText.from_pretrained(
    MODEL_PATH,
    torch_dtype=torch.float32,
    device_map="auto",
    trust_remote_code=True
)

# ==== FastAPI設定 ====
app = FastAPI(title="LFM2-VL Local API")

class InputText(BaseModel):
    prompt: str
    max_new_tokens: int = 200
    temperature: float = 0.7

@app.post("/generate")
def generate_text(data: InputText):
    """
    テキスト入力のみで生成
    """
    conversation = [
        {"role": "user", "content": [{"type": "text", "text": data.prompt}]}
    ]

    inputs = processor.apply_chat_template(
        conversation,
        add_generation_prompt=True,
        return_tensors="pt",
        return_dict=True,
        tokenize=True,
    ).to(model.device)

    outputs = model.generate(
        **inputs,
        max_new_tokens=data.max_new_tokens,
        temperature=data.temperature
    )

    result = processor.batch_decode(outputs, skip_special_tokens=True)[0]
    return {"prompt": data.prompt, "generated_text": result}


@app.post("/vqa")
async def visual_question_answering(
    file: UploadFile = File(...),
    question: str = Form(...),
    max_new_tokens: int = Form(64),
):
    """
    画像＋テキスト質問 (VQA)
    """
    image_bytes = await file.read()
    image = Image.open(BytesIO(image_bytes)).convert("RGB")

    conversation = [
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image},
                {"type": "text", "text": question},
            ],
        }
    ]

    inputs = processor.apply_chat_template(
        conversation,
        add_generation_prompt=True,
        return_tensors="pt"
    ).to(model.device)

    outputs = model.generate(**inputs, max_new_tokens=max_new_tokens)
    result = processor.batch_decode(outputs, skip_special_tokens=True)[0]

    return {"question": question, "answer": result}