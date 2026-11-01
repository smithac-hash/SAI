
import { Link } from 'expo-router';
import type { Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';

export function ExternalLink(
  props: Omit<ComponentProps<typeof Link>, 'href'> & {
    href: string;
  }
) {
  return (
    <Link
      target="_blank"
      {...props}
      href={props.href as Href}
      onPress={(event) => {
        if (Platform.OS !== 'web') {
          event.preventDefault();
          WebBrowser.openBrowserAsync(props.href);
        }
      }}
    />
  );
}
