import os
import shutil
import tempfile
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

# Initialize FastAPI app
app = FastAPI(title="RxList Local Transcription Service (Whisper)")

# Enable CORS for Next.js app running on localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits requests from any origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model variable
model = None

@app.on_event("startup")
def startup_event():
    global model
    try:
        from faster_whisper import WhisperModel
        print("Cargando modelo Whisper 'base' localmente...")
        # device="cpu" is compatible with all hardware.
        # Change device to "cuda" if you have a CUDA-compatible GPU.
        model = WhisperModel("base", device="cpu", compute_type="int8")
        print("Modelo cargado exitosamente. Listo para transcribir en http://127.0.0.1:8000")
    except ImportError:
        print("\n[ADVERTENCIA] 'faster-whisper' no está instalado en tu entorno Python.")
        print("Por favor ejecuta: pip install fastapi uvicorn faster-whisper python-multipart\n")
    except Exception as e:
        print(f"Error al cargar el modelo: {e}")

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    global model
    if model is None:
        return {
            "success": False, 
            "error": "El modelo Whisper no está cargado. Asegúrate de instalar 'faster-whisper' y recargar el servidor."
        }

    suffix = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    temp_handle = tempfile.NamedTemporaryFile(
        prefix="rxlist_audio_", suffix=suffix, delete=False
    )
    temp_file = temp_handle.name
    temp_handle.close()
    try:
        # Save uploaded audio file temporarily
        with open(temp_file, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Run transcription on the saved file
        segments, info = model.transcribe(temp_file, beam_size=5, language="es")
        
        # Concat all segments text
        transcription_text = " ".join([segment.text for segment in segments])
        
        return {
            "success": True, 
            "text": transcription_text.strip(), 
            "language": info.language,
            "probability": info.language_probability
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        # Clean up temp file
        if os.path.exists(temp_file):
            os.remove(temp_file)

@app.get("/health")
async def health_check():
    return {"status": "ok", "model_loaded": model is not None}

if __name__ == "__main__":
    import uvicorn
    print("Iniciando servidor de desarrollo Uvicorn...")
    uvicorn.run(app, host="127.0.0.1", port=8000)
