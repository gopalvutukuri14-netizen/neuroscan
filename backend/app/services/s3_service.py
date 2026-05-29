import boto3
import os
from pathlib import Path
from botocore.exceptions import ClientError

class S3Service:
    _client = None
    BUCKET   = os.getenv("AWS_BUCKET_NAME", "neuroscan-uploads")
    REGION   = os.getenv("AWS_REGION", "ap-south-1")

    @classmethod
    def client(cls):
        if cls._client is None:
            cls._client = boto3.client(
                "s3",
                region_name            = cls.REGION,
                aws_access_key_id      = os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key  = os.getenv("AWS_SECRET_ACCESS_KEY"),
            )
        return cls._client

    @classmethod
    def upload_bytes(cls, data: bytes, key: str, content_type: str = "application/octet-stream") -> str:
        """Upload bytes to S3, return public URL."""
        cls.client().put_object(
            Bucket      = cls.BUCKET,
            Key         = key,
            Body        = data,
            ContentType = content_type,
        )
        return f"https://{cls.BUCKET}.s3.{cls.REGION}.amazonaws.com/{key}"

    @classmethod
    def upload_file(cls, local_path: str, key: str, content_type: str = "application/octet-stream") -> str:
        """Upload a local file to S3, return public URL."""
        cls.client().upload_file(
            Filename    = local_path,
            Bucket      = cls.BUCKET,
            Key         = key,
            ExtraArgs   = {"ContentType": content_type},
        )
        return f"https://{cls.BUCKET}.s3.{cls.REGION}.amazonaws.com/{key}"

    @classmethod
    def download_bytes(cls, key: str) -> bytes:
        """Download file from S3, return bytes."""
        response = cls.client().get_object(Bucket=cls.BUCKET, Key=key)
        return response["Body"].read()

    @classmethod
    def get_public_url(cls, key: str) -> str:
        return f"https://{cls.BUCKET}.s3.{cls.REGION}.amazonaws.com/{key}"

    @classmethod
    def key_exists(cls, key: str) -> bool:
        try:
            cls.client().head_object(Bucket=cls.BUCKET, Key=key)
            return True
        except ClientError:
            return False
