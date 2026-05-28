import os
import aiofiles
from fastapi import UploadFile

class FileService:
    BASE_UPLOAD_DIR = "uploads"

    @staticmethod
    async def save_upload_file(upload_file: UploadFile, user_id: str, record_id: str) -> str:
        # Create directory: uploads/{user_id}/{record_id}
        directory = os.path.join(FileService.BASE_UPLOAD_DIR, user_id, record_id)
        os.makedirs(directory, exist_ok=True)
        
        file_path = os.path.join(directory, upload_file.filename)
        
        async with aiofiles.open(file_path, 'wb') as out_file:
            content = await upload_file.read()
            await out_file.write(content)
            
        return file_path
