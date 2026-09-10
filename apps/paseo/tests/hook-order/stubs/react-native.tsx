/** Host elements only: enough of react-native for react-test-renderer to mount the plugin's client. */
import React from "react";
const host = (tag: string) => ({ children, ...props }: any) => React.createElement(tag, props, children);
export const View = host("View");
export const Text = host("Text");
export const ScrollView = host("ScrollView");
export const Pressable = host("Pressable");
export const TextInput = host("TextInput");
export const ActivityIndicator = host("ActivityIndicator");
export const Linking = { openURL: async (_url: string) => {} };
export const Clipboard = { setString: (_text: string) => {} };
