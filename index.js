// dependencies
const AWS = require("aws-sdk");
const util = require("util");
const sharp = require("sharp");

// get reference to S3 client
const s3 = new AWS.S3();

async function getOriginalImage(srcKey, srcBucket) {
    // Download the image from the S3 source bucket.

    try {
        const params = {
            Bucket: srcBucket,
            Key: srcKey
        };
        let origimage = await s3.getObject(params).promise();
        return origimage;
    } catch (error) {
        console.log(error);
        return;
    }
}

// image size in pixel (based on wordpress predetermined image sizes)
const imageSize = {
    thumbnail: 150,
    md: 300,
    lg: 1024,
    xlg: 1500
};

async function resizeImage(origimage) {
    // set thumbnail width. Resize will set the height automatically to maintain aspect ratio.
    // const width = 200;
    return await Promise.all(
        Object.keys(imageSize).map(async key => {
            // Use the sharp module to resize the image and save in a buffer.
            try {
                let buffer = await sharp(origimage.Body)
                    .resize(imageSize[key])
                    .toBuffer();
                return buffer;
            } catch (error) {
                console.log(error);
                return;
            }
        })
    ).catch(err => {
        console.error(err);
    });
}

async function uploadResizedImage(
    buffers,
    { fileName, srcKey, srcBucket, imagesPathParam, avatarPathParam, dstBucket }
) {
    const imageSizeKeys = Object.keys(imageSize)
    let dstKey;
    await Promise.all(
        buffers.map(async (buffer, index) => {
            const imgSize = imageSizeKeys[index];
            dstKey = `${avatarPathParam}/${imagesPathParam}/compressed/${imgSize}/${fileName}-${imgSize}.png`
            try {
                const destparams = {
                    Bucket: dstBucket,
                    Key: dstKey,
                    Body: buffer,
                    ContentType: "image",
                    ACL: 'public-read'
                };

                const putResult = await s3.putObject(destparams).promise();
                console.log('putResult', putResult);
                // putResult.then(res => console.log(res)).catch(err => console.error(err))
            } catch (error) {
                console.log(error);
                return;
            }
        })
    ).catch(err => {
        console.error(err);
    });

    console.log(
        "Successfully resized " +
        srcBucket +
        "/" +
        srcKey +
        " and uploaded to " +
        dstBucket +
        "/" +
        dstKey
    );
}

// avatar/images/raw
// avatar/images/compressed
// avatar/images/compressed/{sm/lg/md/xl}

exports.handler = async (event, context, callback) => {
    // Read options from the event parameter.
    console.log(
        "Reading options from event:\n",
        util.inspect(event, { depth: 5 })
    );
    const srcBucket = event.Records[0].s3.bucket.name;
    // console.log("srcBucket", srcBucket);
    // Object key may have spaces or unicode non-ASCII characters.
    const srcKey = decodeURIComponent(
        event.Records[0].s3.object.key.replace(/\+/g, " ")
    );
    console.log('srcKey', srcKey)
    const dstBucket = srcBucket;
    const keyPath = srcKey.split('/');
    console.log(keyPath);
    const avatarPathParam = keyPath[0];
    const imagesPathParam = keyPath[1];
    const rawPathParam = keyPath[2];
    const filePathParam = keyPath[3];
    // const dstKey = "resized-" + srcKey;

    // console.log(typeMatch);
    // if (!typeMatch) {
    //     console.log("Could not determine the image type.");
    //     return;
    // }
    // Extract filename
    const fileName = filePathParam.replace(/\.([^.]*)$/, "");

    // Infer the image type from the file suffix.
    const typeMatch = srcKey.match(/\.([^.]*)$/);
    // Check that the image type is supported
    const imageType = typeMatch[1].toLowerCase();
    if (imageType !== "jpg" && imageType !== "jpeg" && imageType !== "png") {
        console.log(`Unsupported image type: ${imageType}`);
        return;
    }

    // Get the original Image
    const origimage = await getOriginalImage(srcKey, srcBucket);
    if (!origimage) return;

    // Resize image
    const buffer = await resizeImage(origimage);
    if (!buffer) return;

    // Upload the resized image to the destination bucket
    await uploadResizedImage(buffer, { fileName, srcKey, srcBucket, dstBucket, rawPathParam, imagesPathParam, avatarPathParam });
};

