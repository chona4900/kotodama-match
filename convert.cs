using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;

public class SpriteConverter {
    public static void Convert() {
        string imgPath = @"c:\Users\washi\Dropbox\作業用\kotodama-match\白蛇っち.jpg";
        if (!File.Exists(imgPath)) {
            Console.WriteLine("File not found: " + imgPath);
            return;
        }
        using (Bitmap img = new Bitmap(imgPath)) {
            int frameW = img.Width / 3;
            int h = img.Height;
            for (int i=0; i<3; i++) {
                Bitmap crop = img.Clone(new Rectangle(i*frameW, 0, frameW, h), img.PixelFormat);
                
                int minX = frameW, minY = h, maxX = 0, maxY = 0;
                for (int y=0; y<h; y++) {
                    for (int x=0; x<frameW; x++) {
                        Color c = crop.GetPixel(x,y);
                        int brightness = (c.R + c.G + c.B) / 3;
                        if (brightness < 240) {
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;
                        }
                    }
                }
                
                if (minX <= maxX) {
                    int cW = maxX - minX + 1;
                    int cH = maxY - minY + 1;
                    int sqSize = Math.Max(cW, cH);
                    
                    Bitmap sq = new Bitmap(sqSize, sqSize);
                    using (Graphics g = Graphics.FromImage(sq)) {
                        g.Clear(Color.White);
                        int offX = (sqSize - cW)/2;
                        int offY = (sqSize - cH)/2;
                        g.DrawImage(crop, new Rectangle(offX, offY, cW, cH), new Rectangle(minX, minY, cW, cH), GraphicsUnit.Pixel);
                    }
                    
                    Bitmap final = new Bitmap(24, 24);
                    using (Graphics g = Graphics.FromImage(final)) {
                        g.InterpolationMode = InterpolationMode.NearestNeighbor;
                        g.DrawImage(sq, 0, 0, 24, 24);
                    }
                    
                    Console.WriteLine("[");
                    for (int y=0; y<24; y++) {
                        string line = "\"";
                        for (int x=0; x<24; x++) {
                            Color c = final.GetPixel(x,y);
                            int b = (c.R + c.G + c.B) / 3;
                            if (b < 200) line += "\u2588";
                            else line += " ";
                        }
                        line += "\"";
                        if (y < 23) line += ",";
                        Console.WriteLine("    " + line);
                    }
                    Console.WriteLine("],");
                }
            }
        }
    }
}
