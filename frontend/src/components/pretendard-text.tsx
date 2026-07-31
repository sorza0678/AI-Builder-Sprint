import { forwardRef } from 'react';
import {
  StyleSheet,
  Text as NativeText,
  type TextProps,
  type TextStyle,
} from 'react-native';

const FONT_FAMILIES = {
  light: 'Pretendard-Light',
  regular: 'Pretendard-Regular',
  medium: 'Pretendard-Medium',
  semibold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
} as const;

function getFontFamily(fontWeight: TextStyle['fontWeight']) {
  if (fontWeight === 'bold' || Number(fontWeight) >= 700) {
    return FONT_FAMILIES.bold;
  }
  if (Number(fontWeight) >= 600) {
    return FONT_FAMILIES.semibold;
  }
  if (Number(fontWeight) >= 500) {
    return FONT_FAMILIES.medium;
  }
  if (Number(fontWeight) > 0 && Number(fontWeight) <= 300) {
    return FONT_FAMILIES.light;
  }
  return FONT_FAMILIES.regular;
}

export const Text = forwardRef<NativeText, TextProps>(function PretendardText(
  { style, ...props },
  ref,
) {
  const flattenedStyle = StyleSheet.flatten(style);
  const fontFamily = getFontFamily(flattenedStyle?.fontWeight);

  return (
    <NativeText
      ref={ref}
      {...props}
      style={[style, { fontFamily, fontWeight: undefined }]}
    />
  );
});
