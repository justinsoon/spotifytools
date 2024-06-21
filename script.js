const clientId = 'f6e537a709ed4244a7da8a33c1cb24ad'; // Your Spotify Client ID
const redirectUri = 'justinsoon.io/spotifytools'; // Ensure this matches the URI in Spotify Developer Dashboard
const scopes = 'playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public';
let accessToken = '';
let fetchedSongs = [];

function authenticate() {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
    window.location = authUrl;
}

function showTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    document.querySelector(`.tab[onclick="showTab('${tab}')"]`).classList.add('active');
    document.getElementById(tab).classList.add('active');
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.remove('hide');
    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
        notification.classList.add('hide');
    }, 8000); // 8 seconds
}

function closeModal() {
    const modal = document.getElementById('editPlaylistDetailsModal');
    modal.style.display = 'none';
}

function openModal() {
    const modal = document.getElementById('editPlaylistDetailsModal');
    modal.style.display = 'block';
}

function savePlaylistDetails() {
    const playlistName = document.getElementById('playlistNameInput').value;
    const playlistDescription = document.getElementById('playlistDescriptionInput').value;
    const songInput = document.getElementById('songInputModal').value;
    const songTitles = songInput.split('|').map(title => title.trim());

    if (!playlistName) {
        showNotification('Please enter a playlist name.');
        return;
    }

    if (playlistDescription.length > 300) {
        showNotification('Playlist description exceeds 300 characters.');
        return;
    }

    if (!songTitles.length) {
        showNotification('Song list is empty.');
        return;
    }

    if (!accessToken) {
        showNotification('Please log in to your Spotify account.');
        return;
    }

    const unmatchedSongs = songTitles.filter(song => !fetchedSongs.some(fetchedSong => fetchedSong.title === song));
    if (unmatchedSongs.length > 0) {
        showNotification(`These songs are not part of the fetched playlist: ${unmatchedSongs.join(', ')}`);
        return;
    }

    createSpotifyPlaylist(playlistName, playlistDescription, songTitles);
    closeModal();
}

function fetchStorySongs() {
    const storyPlaylistURL = document.getElementById('storyPlaylistURL').value;
    if (!storyPlaylistURL) {
        showNotification('Please enter a valid Spotify playlist URL.');
        return;
    }
    localStorage.setItem('storyPlaylistURL', storyPlaylistURL);
    fetchSongsFromURL(storyPlaylistURL);
}

async function fetchSongsFromURL(playlistURL) {
    const playlistId = extractPlaylistId(playlistURL);
    if (!playlistId) {
        showNotification('Invalid playlist URL.');
        return;
    }

    accessToken = getAccessTokenFromUrl();
    if (!accessToken) {
        showNotification('Please log in to your Spotify account.');
        return;
    }

    fetchedSongs = [];
    let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;
    let data;

    do {
        data = await fetchData(url);
        if (!data.items) {
            showNotification('Failed to fetch playlist.');
            return;
        }
        fetchedSongs.push(...data.items.map(item => ({
            title: item.track.name,
            uri: item.track.uri,
            id: item.track.id
        })));
        url = data.next;
    } while (data.next);

    displaySongTitles(fetchedSongs.map(song => song.title));
    generateStoryPrompt(fetchedSongs.map(song => song.title));
    checkVisibility();
}

function displaySongTitles(songTitles) {
    document.getElementById('songList').value = songTitles.join('\n');
}

function generateStoryPrompt(songTitles) {
    const prompt = `Make a story or subliminal message using these song titles... ${songTitles.join('|')}`;
    document.getElementById('storyOutput').value = prompt;
}

function fetchAndDisplayGenres() {
    const genrePlaylistURL = document.getElementById('genrePlaylistURL').value;
    if (!genrePlaylistURL) {
        showNotification('Please enter a valid Spotify playlist URL.');
        return;
    }
    localStorage.setItem('genrePlaylistURL', genrePlaylistURL);
    createGenrePlaylists(genrePlaylistURL);
}

async function createGenrePlaylists(playlistURL) {
    const playlistId = extractPlaylistId(playlistURL);
    if (!playlistId) {
        showNotification('Invalid playlist URL.');
        return;
    }

    accessToken = getAccessTokenFromUrl();
    if (!accessToken) {
        showNotification('Please log in to your Spotify account.');
        return;
    }

    let genreSongs = [];
    let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;
    let data;

    do {
        data = await fetchData(url);
        if (!data.items) {
            showNotification('Failed to fetch playlist.');
            return;
        }
        genreSongs.push(...data.items.map(item => ({
            id: item.track.id,
            uri: item.track.uri,
            name: item.track.name,
            artists: item.track.artists.map(artist => artist.name).join(', ')
        })));
        url = data.next;
    } while (data.next);

    await fetchTrackGenresAndCreatePlaylists(genreSongs);
}

async function fetchTrackGenresAndCreatePlaylists(tracks) {
    const genreMap = {};
    for (let i = 0; i < tracks.length; i += 50) {
        const batch = tracks.slice(i, i + 50);
        const ids = batch.map(track => track.id).join(',');

        const trackData = await fetchData(`https://api.spotify.com/v1/tracks?ids=${ids}`);
        for (const track of trackData.tracks) {
            for (const artist of track.artists) {
                const artistData = await fetchData(`https://api.spotify.com/v1/artists/${artist.id}`);
                if (artistData.genres && artistData.genres.length > 0) {
                    artistData.genres.forEach(genre => {
                        if (!genreMap[genre]) genreMap[genre] = [];
                        genreMap[genre].push({
                            name: track.name,
                            uri: track.uri,
                            artists: track.artists.map(artist => artist.name).join(', ')
                        });
                    });
                }
            }
        }
    }

    accessToken = getAccessTokenFromUrl();
    if (!accessToken) {
        showNotification('Access token is missing. Please authenticate.');
        return;
    }

    const userResponse = await fetchData('https://api.spotify.com/v1/me');
    const userId = userResponse.id;

    for (const genre of Object.keys(genreMap)) {
        const tracks = genreMap[genre];
        const createPlaylistResponse = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: genre,
                description: 'Made with Spotify Tools',
                public: false
            })
        });
        const createPlaylistData = await createPlaylistResponse.json();
        const playlistId = createPlaylistData.id;

        const trackURIs = tracks.map(track => track.uri);

        await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uris: trackURIs
            })
        });

        console.log(`Added tracks to ${genre} playlist`);
    }

    showNotification('Genre playlists created successfully!');
}

async function fetchData(url, retries = 3) {
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : 3000;
        console.log(`Rate limited. Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchData(url, retries - 1);
    }

    if (!response.ok && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        return fetchData(url, retries - 1);
    }

    if (!response.ok) {
        showNotification(`Failed to fetch: ${response.statusText}`);
        throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    return response.json();
}

function extractPlaylistId(playlistURL) {
    try {
        const url = new URL(playlistURL);
        const paths = url.pathname.split('/');
        const playlistIndex = paths.indexOf('playlist');
        if (playlistIndex !== -1 && paths[playlistIndex + 1]) {
            return paths[playlistIndex + 1];
        }
        return null;
    } catch (error) {
        console.error('Error parsing URL:', error);
        showNotification('Invalid playlist URL format.');
        return null;
    }
}

function getAccessTokenFromUrl() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    return params.get('access_token');
}

function copyToClipboard(elementId) {
    const textarea = document.getElementById(elementId);
    textarea.select();
    document.execCommand('copy');
}

function displayUserProfile(profile) {
    const loginButton = document.querySelector('.login-button');
    const profilePicture = document.createElement('div');
    profilePicture.classList.add('profile-picture');
    profilePicture.innerHTML = `<img src="${profile.images[0].url}" alt="Profile Picture">`;
    loginButton.replaceWith(profilePicture);
}

async function fetchUserProfile() {
    const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        console.error('Failed to fetch user profile:', response.statusText);
        return;
    }

    const profile = await response.json();
    displayUserProfile(profile);
}

function checkVisibility() {
    const storyPlaylistURL = document.getElementById('storyPlaylistURL').value;
    const songPromptContainer = document.getElementById('songPromptContainer');
    if (storyPlaylistURL && fetchedSongs.length > 0 && accessToken) {
        songPromptContainer.classList.remove('hidden');
    } else {
        songPromptContainer.classList.add('hidden');
    }
}

window.onload = function() {
    const songPromptContainer = document.getElementById('songPromptContainer');
    songPromptContainer.classList.add('hidden'); // Hide the container initially

    if (window.location.hash) {
        accessToken = getAccessTokenFromUrl();
        fetchUserProfile(); // Fetch and display user profile picture

        const activeTab = document.querySelector('.tab.active').textContent.trim();
        if (activeTab === 'Story Generator') {
            const storyPlaylistURL = localStorage.getItem('storyPlaylistURL');
            if (storyPlaylistURL) {
                document.getElementById('storyPlaylistURL').value = storyPlaylistURL;
                fetchSongsFromURL(storyPlaylistURL).then(checkVisibility);
            } else {
                checkVisibility();
            }
        } else if (activeTab === 'Playlist Genre Sorter') {
            const genrePlaylistURL = localStorage.getItem('genrePlaylistURL');
            if (genrePlaylistURL) {
                document.getElementById('genrePlaylistURL').value = genrePlaylistURL;
                createGenrePlaylists(genrePlaylistURL).then(checkVisibility);
            } else {
                checkVisibility();
            }
        }
    } else {
        checkVisibility();
    }
};

document.getElementById('storyPlaylistURL').addEventListener('input', checkVisibility);
document.getElementById('genrePlaylistURL').addEventListener('input', checkVisibility);
