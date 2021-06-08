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

// image size in pixel
const imageSize = {
    sm: 200,
    md: 400,
    lg: 600,
    xlg: 800
};

async function resizeImage(origimage) {
    // set thumbnail width. Resize will set the height automatically to maintain aspect ratio.
    const width = 200;
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
    { fileName, srcKey, srcBucket, dstKey, dstBucket }
) {
    const imageSizeKeys = Object.keys(imageSize);
    await Promise.all(
        buffers.map(async (buffer, index) => {
            const imgSize = imageSizeKeys[index];
            try {
                const destparams = {
                    Bucket: dstBucket,
                    Key: `${imgSize}/${fileName}-${imgSize}.png`,
                    Body: buffer,
                    ContentType: "image"
                };

                const putResult = await s3.putObject(destparams).promise();
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

exports.handler = async (event, context, callback) => {
    // Read options from the event parameter.
    console.log(
        "Reading options from event:\n",
        util.inspect(event, { depth: 5 })
    );
    const srcBucket = event.Records[0].s3.bucket.name;
    console.log("srcBucket", srcBucket);
    // Object key may have spaces or unicode non-ASCII characters.
    const srcKey = decodeURIComponent(
        event.Records[0].s3.object.key.replace(/\+/g, " ")
    );
    const dstBucket = srcBucket + "-test";
    const dstKey = "resized-" + srcKey;

    // Infer the image type from the file suffix.
    const typeMatch = srcKey.match(/\.([^.]*)$/);
    if (!typeMatch) {
        console.log("Could not determine the image type.");
        return;
    }

    // Extract filename
    const fileName = srcKey.replace(/\.([^.]*)$/, "");

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
    await uploadResizedImage(buffer, { fileName, srcKey, srcBucket, dstKey, dstBucket });
};
