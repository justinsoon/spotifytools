# Spotify Tools By Justin Soon

A web application that provides various tools for enhancing your Spotify experience. With this app, you can create custom playlists based on your top artists and tracks, generate playlists similar to a given playlist, create stories from song titles, and sort songs into genre-based playlists.

## Features

- **Custom Discover Playlist**: Create a playlist based on your top artists and tracks, featuring new songs released within the last month.
- **Similar Playlist**: Generate a playlist of songs similar to those in a provided Spotify playlist.
- **Spotify Story**: Generate a story or subliminal message from the song titles of a given Spotify playlist.
- **Genre Sorter**: Create multiple playlists based on the main genre of the songs from a provided Spotify playlist.

## Getting Started

### Prerequisites

- A Spotify account.
- A web browser.

### Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/yourusername/spotify-tools.git
    cd spotify-tools
    ```

2. Open `index.html` in your web browser to start using the app.

### Authentication

To use the app, you need to authenticate with your Spotify account:

1. Click on the "Log in" button.
2. Authorize the app to access your Spotify data.

### Usage

#### Custom Discover Playlist

1. Click on the "Custom Discover" tab.
2. Click the "Create playlist" button to generate a playlist based on your top artists and tracks.

#### Similar Playlist

1. Click on the "Similar Playlist" tab.
2. Enter a Spotify playlist URL in the input field.
3. Click the "Create playlist" button to generate a similar playlist.

#### Spotify Story

1. Click on the "Spotify Story" tab.
2. Enter a Spotify playlist URL in the input field.
3. Click the "Fetch" button to generate a story from the song titles.
4. Copy the song titles or the AI-generated prompt using the copy buttons.

#### Genre Sorter

1. Click on the "Genre Sorter" tab.
2. Enter a Spotify playlist URL in the input field.
3. Click the "Fetch" button to sort the songs into genre-based playlists.

## Files

- `index.html`: The main HTML file.
- `styles.css`: The CSS file for styling the app.
- `script.js`: The JavaScript file containing the logic for the app.

## Functions

### Authentication

- `authenticate()`: Redirects the user to Spotify's authentication page.
- `logout()`: Logs out the user and clears stored data.

### Tab Navigation

- `showTab(tab)`: Displays the selected tab content.

### Notifications

- `showNotification(message)`: Displays a notification message.
- `closeModal()`: Closes the edit playlist details modal.
- `openModal()`: Opens the edit playlist details modal.

### Custom Discover Playlist

- `createCustomDiscoverPlaylist()`: Creates a custom discover playlist based on the user's top tracks and artists.

### Similar Playlist

- `createSimilarPlaylist()`: Creates a playlist similar to the provided playlist.

### Spotify Story

- `fetchStorySongs()`: Fetches songs from the provided playlist URL and generates a story.
- `fetchSongsFromURL(playlistURL)`: Fetches songs from the Spotify playlist.

### Genre Sorter

- `fetchAndDisplayGenres()`: Fetches and displays genres for the provided playlist.
- `createGenrePlaylists(playlistURL)`: Creates genre-based playlists from the provided playlist URL.

### Utility Functions

- `fetchWebApi(endpoint, method, body, retries, retryDelay)`: Fetches data from the Spotify Web API.
- `copyToClipboard(elementId)`: Copies the content of a specified element to the clipboard.
- `displayUserProfile(profile)`: Displays the user's profile picture.
- `incrementMapCount(map, key)`: Increments the count of a key in a map.
- `getMainGenre(genres)`: Returns the main genre from a list of genres.

## Contributing

Contributions are welcome! Please fork the repository and create a pull request with your changes.

## License

This project is licensed under the MIT License. 

## Contact

If you have any questions, please feel free to reach out.
