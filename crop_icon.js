const { Jimp } = require('jimp');
const fs = require('fs');

async function main() {
    try {
        console.log('Loading image...');
        // Load the image
        const image = await Jimp.read('恵比寿っち.jpg');
        
        console.log(`Original Size: ${image.bitmap.width}x${image.bitmap.height}`);
        
        // The image has 3 frames horizontally. Let's calculate the width of one frame.
        const frameWidth = Math.floor(image.bitmap.width / 3);
        const frameHeight = image.bitmap.height;
        
        // Let's crop the center frame (or the left frame). The user said "any one of them".
        // The leftmost is often the default "idle" frame. Let's crop x=0.
        console.log(`Cropping to ${frameWidth}x${frameHeight}`);
        image.crop({ x: 0, y: 0, w: frameWidth, h: frameHeight });
        
        // Create an icon (1024x1024)
        console.log('Generating icon.png...');
        // Let's find background color from the top-left pixel
        const bgColorInt = image.getPixelColor(1, 1);
        
        // Create 1024x1024 blank canvas with bgColor
        const icon = new Jimp({ width: 1024, height: 1024, color: bgColorInt });
        
        // Resize cropped image to fit within the icon (leaving some padding so it looks good)
        // Let's make the height 80% of 1024
        const targetHeight = Math.floor(1024 * 0.8);
        const iconImage = image.clone();
        iconImage.resize({ h: targetHeight });
        
        // Center the image
        const xIcon = Math.floor((1024 - iconImage.bitmap.width) / 2);
        const yIcon = Math.floor((1024 - iconImage.bitmap.height) / 2);
        
        icon.composite(iconImage, xIcon, yIcon);
        await icon.write('icon.png');
        console.log('icon.png generated.');

        // Generate splash screen (2732x2732)
        console.log('Generating splash.png...');
        const splash = new Jimp({ width: 2732, height: 2732, color: bgColorInt });
        
        const splashTargetHeight = Math.floor(2732 * 0.4);
        const splashImage = image.clone();
        splashImage.resize({ h: splashTargetHeight });
        
        const xSplash = Math.floor((2732 - splashImage.bitmap.width) / 2);
        const ySplash = Math.floor((2732 - splashImage.bitmap.height) / 2);
        
        splash.composite(splashImage, xSplash, ySplash);
        await splash.write('splash.png');
        console.log('splash.png generated.');
        
    } catch (err) {
        console.error('Error during image processing:', err);
    }
}

main();
