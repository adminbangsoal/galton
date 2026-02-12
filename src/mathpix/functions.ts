import axios from 'axios';

interface MathpixResponse {
  data: any;
  html: string;
  request_id: string;
  text: string;
  version: string;
}

type choices = 'A' | 'B' | 'C' | 'D';

const generateTextMathpix = async (src: string) => {
  const { data } = await axios.post(
    'https://api.mathpix.com/v3/text',
    {
      src: src,
      formats: ['text', 'data', 'html', 'latex_styled'],
    },
    {
      headers: {
        app_id: process.env.MATHPIX_APP_ID,
        app_key: process.env.MATHPIX_APP_KEY,
        'Content-Type': 'application/json',
      },
    },
  );
  return data as MathpixResponse;
};

const scanImageUrlService = async (imageUrl: string) => {
  imageUrl = getGDriveImageUrl(imageUrl);
  try {
    const result = await generateTextMathpix(imageUrl);
    if (!result.text) {
      console.warn('Error in scanning image: ', imageUrl);
      console.warn((result as any).error || 'No text found');
      return '';
    }

    result.text = result.text.replace('(C)', '&#40;C&#41;');
    result.text = result.text.replace('(c)', '&#40;c&#41;');

    return result.text;
  } catch (error) {
    console.warn('Error in scanning image: ', imageUrl);
    console.warn('Error: ', error);
    return '';
  }
};

const getGDriveImageUrl = (imageUrl: string) => {
  if (imageUrl.includes('drive.google')) {
    const id = imageUrl.split('/d/')?.[1]?.split('/')[0];
    imageUrl = `https://drive.google.com/uc?export=download&id=${id}`;
    return imageUrl;
  }

  return imageUrl;
};

const extractChoices = (text: string) => {
  const patterns = {
    A: /(?:\(A\)|A\.|a\.|\(a\)|A\)) ([^\n]*)/,
    B: /(?:\(B\)|B\.|b\.|\(b\)|B\)) ([^\n]*)/,
    C: /(?:\(C\)|C\.|c\.|\(c\)|C\)) ([^\n]*)/,
    D: /(?:\(D\)|D\.|d\.|\(d\)|D\)) ([^\n]*)/,
    E: /(?:\(E\)|E\.|e\.|\(e\)|E\)) ([^\n]*)/,
  };
  const result = {} as {
    A: string;
    B: string;
    C: string;
    D: string;
    E?: string;
  };

  for (const key in patterns) {
    const match = text.match(patterns[key as choices]);
    if (match) result[key as choices] = match[1];
  }

  return result;
};

export {
  generateTextMathpix,
  scanImageUrlService,
  getGDriveImageUrl,
  extractChoices,
};
