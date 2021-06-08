# Image resizer lambda function triggered by S3 example

## Guide on uploading to AWS
1. zip the file `zip -r function.zip .`
2. run the command for creating a new function if the function doesn't exist yet
3. run command for updating if the function already exist

### create function
```bash
aws lambda create-function --function-name create-thumbnail --zip-file fileb://function.zip --profile qhkm --region ap-northeast-1 --role arn:aws:iam::3213213213123:role/lambda-s3-role --timeout 10 --memory-size 1024 --runtime nodejs12.x --handler index.handler
```

### update function
```bash
aws lambda update-function-code --function-name create-thumbnail --zip-file fileb://function.zip --profile qhkm --region ap-northeast-1
```