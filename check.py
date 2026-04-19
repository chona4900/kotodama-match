from PIL import Image
for f in ['八咫鏡.jpg', '草薙剣.jpg', '八尺瓊勾玉.jpg', '宝珠.jpg', '三鈷杵.jpg', '神楽鈴.jpg']:
  try:
    print(f, Image.open(f'../kotodama-match/{f}').size)
  except Exception as e:
    print(f,e)
