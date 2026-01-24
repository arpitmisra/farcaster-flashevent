import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../styles/theme';

export default function Avatar({
  source,
  name,
  size = 'md', // 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number
  showBorder = false,
  borderColor = colors.primary,
  style,
}) {
  const getSizeValue = () => {
    // Support numeric sizes directly
    if (typeof size === 'number') {
      return size;
    }
    switch (size) {
      case 'xs':
        return spacing.avatarXs;
      case 'sm':
        return spacing.avatarSm;
      case 'lg':
        return spacing.avatarLg;
      case 'xl':
        return spacing.avatarXl;
      case '2xl':
        return spacing.avatar2xl;
      default:
        return spacing.avatarMd;
    }
  };

  const sizeValue = getSizeValue();
  const fontSize = sizeValue * 0.4;

  // Get initials from name
  const getInitials = () => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const containerStyle = [
    styles.container,
    {
      width: sizeValue,
      height: sizeValue,
      borderRadius: sizeValue / 2,
    },
    showBorder && {
      borderWidth: 2,
      borderColor,
    },
    style,
  ];

  if (source?.uri) {
    return (
      <View style={containerStyle}>
        <Image
          source={source}
          style={[
            styles.image,
            {
              width: sizeValue - (showBorder ? 4 : 0),
              height: sizeValue - (showBorder ? 4 : 0),
              borderRadius: (sizeValue - (showBorder ? 4 : 0)) / 2,
            },
          ]}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View style={[containerStyle, styles.placeholder]}>
      <Text style={[styles.initials, { fontSize }]}>{getInitials()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    backgroundColor: colors.backgroundElevated,
  },
  placeholder: {
    backgroundColor: colors.primary + '40',
  },
  initials: {
    color: colors.primary,
    fontWeight: '600',
  },
});
