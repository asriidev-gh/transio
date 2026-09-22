import { Redirect } from 'expo-router';

/** Favorites moved into History filters — keep route for deep links. */
export default function FavoritesRedirect() {
  return <Redirect href="/(app)/(tabs)/history" />;
}
