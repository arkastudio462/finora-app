declare module '@expo/vector-icons' {
  import { ComponentType } from 'react';
  import { TextProps, ColorValue } from 'react-native';

  interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string | ColorValue;
  }

  export const MaterialCommunityIcons: ComponentType<IconProps>;
  export const Ionicons: ComponentType<IconProps>;
  export const FontAwesome: ComponentType<IconProps>;
  export const Feather: ComponentType<IconProps>;
}
