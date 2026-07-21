import os, tempfile
from fastapi import FastAPI, File, HTTPException, UploadFile
from faster_whisper import WhisperModel
app=FastAPI()
model=WhisperModel(os.getenv("WHISPER_MODEL","small"),device="cpu",compute_type="int8")
@app.get("/health")
def health(): return {"ok":True}
@app.post("/transcribe")
async def transcribe(audio: UploadFile=File(...)):
    if audio.content_type not in {"audio/webm","audio/wav","audio/mpeg","audio/mp4","audio/ogg"}: raise HTTPException(415,"Formato no admitido")
    data=await audio.read()
    if len(data)>20*1024*1024: raise HTTPException(413,"Audio demasiado grande")
    fd,path=tempfile.mkstemp(suffix=".audio")
    try:
        with os.fdopen(fd,"wb") as f: f.write(data)
        segments,_=model.transcribe(path,language="es",vad_filter=True)
        return {"text":" ".join(s.text.strip() for s in segments).strip()}
    finally:
        try: os.unlink(path)
        except FileNotFoundError: pass
