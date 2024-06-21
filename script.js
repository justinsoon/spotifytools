const clientId = 'f6e537a709ed4244a7da8a33c1cb24ad'; // Your Spotify Client ID
const redirectUri = 'http://localhost:8080'; // Ensure this matches the URI in Spotify Developer Dashboard
const scopes = 'playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public';
let accessToken = '';
let fetchedSongs = [];
let genreSongs = [];

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

function fetchSongs() {
    const playlistURL = document.getElementById('playlistURL').value;
    if (!playlistURL) {
        alert('Please enter a valid Spotify playlist URL.');
        return;
    }
    localStorage.setItem('playlistURL', playlistURL);
    fetchSongsFromURL(playlistURL);
}

function fetchAndCreate() {
    const playlistURL = document.getElementById('genrePlaylistURL').value;
    if (!playlistURL) {
        alert('Please enter a valid Spotify playlist URL.');
        return;
    }
    localStorage.setItem('genrePlaylistURL', playlistURL);
    fetchGenresFromURL(playlistURL);
}

function getAccessTokenFromUrl() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    console.log('Access Token:', token);
    return token;
}

function extractPlaylistId(playlistURL) {
    try {
        const url = new URL(playlistURL);
        const paths = url.pathname.split('/');
        console.log('URL Paths:', paths);
        const playlistIndex = paths.indexOf('playlist');
        if (playlistIndex !== -1 && paths[playlistIndex + 1]) {
            return paths[playlistIndex + 1];
        }
        return null;
    } catch (error) {
        console.error('Error parsing URL:', error);
        alert('Invalid playlist URL format. Please enter a valid Spotify playlist URL.');
        return null;
    }
}

async function fetchSongsFromURL(playlistURL) {
    const playlistId = extractPlaylistId(playlistURL);
    if (!playlistId) {
        alert('Invalid playlist URL. Please enter a valid Spotify playlist URL.');
        return;
    }

    accessToken = getAccessTokenFromUrl();

    if (!accessToken) {
        alert('Please log in to your spotify account, so we can fetch your playlist data.');
        return;
    }

    const fetchData = async (url) => {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response.json();
    };

    let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
    let data;
    do {
        data = await fetchData(url);
        if (!data.items) {
            alert('Failed to fetch playlist. Please ensure the playlist URL is correct and try again.');
            return;
        }
        fetchedSongs.push(...data.items.map(item => ({
            title: item.track.name,
            uri: item.track.uri
        })));
        url = data.next;
    } while (data.next);

    const songTitles = fetchedSongs.map(song => song.title);
    displaySongTitles(songTitles);
    generateStoryPrompt(songTitles);
}

async function fetchWithRetry(url, options = {}, retries = 5, backoff = 3000) {
    while (retries > 0) {
        try {
            const response = await fetch(url, options);
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                const delay = retryAfter ? parseInt(retryAfter) * 1000 : backoff;
                console.log(`Rate limited. Retrying in ${delay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                retries--;
            } else {
                return response.json();
            }
        } catch (error) {
            console.error('Fetch error:', error);
            if (retries === 0) throw error;
            await new Promise(resolve => setTimeout(resolve, backoff));
            retries--;
        }
    }
}

async function fetchGenresFromURL(playlistURL) {
    const playlistId = extractPlaylistId(playlistURL);
    if (!playlistId) {
        alert('Invalid playlist URL. Please enter a valid Spotify playlist URL.');
        return;
    }

    accessToken = getAccessTokenFromUrl();

    if (!accessToken) {
        alert('Access token is missing. Please authenticate.');
        return;
    }

    const fetchData = async (url) => {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response.json();
    };

    let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
    let data;
    do {
        data = await fetchData(url);
        if (!data.items) {
            alert('Failed to fetch playlist. Please ensure the playlist URL is correct and try again.');
            return;
        }
        genreSongs.push(...data.items.map(item => ({
            id: item.track.id,
            uri: item.track.uri,
            artists: item.track.artists
        })));
        url = data.next;
    } while (data.next);

    await fetchTrackGenres();
}

async function fetchTrackGenres() {
    const genreMap = {};
    const progressBar = document.getElementById('progress');
    const progressText = document.getElementById('progress-text');
    const totalTracks = genreSongs.length;

    for (let i = 0; i < totalTracks; i++) {
        const track = genreSongs[i];
        const trackData = await fetchWithRetry(`https://api.spotify.com/v1/tracks/${track.id}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (trackData.artists && trackData.artists.length > 0) {
            for (let artist of trackData.artists) {
                const artistData = await fetchWithRetry(`https://api.spotify.com/v1/artists/${artist.id}`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                if (artistData.genres && artistData.genres.length > 0) {
                    artistData.genres.forEach(genre => {
                        if (!genreMap[genre]) {
                            genreMap[genre] = [];
                        }
                        genreMap[genre].push(track.uri);
                    });
                }
            }
        }

        const progress = Math.round(((i + 1) / totalTracks) * 100);
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${progress}%`;
    }

    await createGenrePlaylists(genreMap);
    alert('Genre playlists created successfully!');
}

async function createGenrePlaylists(genreMap) {
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    const userData = await userResponse.json();
    const userId = userData.id;

    for (const [genre, uris] of Object.entries(genreMap)) {
        const createPlaylistResponse = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: genre,
                description: 'Made with justinsoon.io/spotifytools',
                public: false
            })
        });
        const createPlaylistData = await createPlaylistResponse.json();
        const playlistId = createPlaylistData.id;

        await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uris: uris
            })
        });

        console.log(`Added tracks to ${genre} playlist`);
    }
}

function displaySongTitles(songTitles) {
    const songList = document.getElementById('songList');
    songList.value = songTitles.join('\n');
}

function copyToClipboard(elementId) {
    const textArea = document.getElementById(elementId);
    textArea.select();
    document.execCommand('copy');
}

function generateStoryPrompt(songTitles) {
    const storyOutput = document.getElementById('storyOutput');
    const prompt = `Make a story or subliminal message by only using these song titles. Re-organize, but do not remove any of the songs, to make the story captivating and fluent. Give the entire re-ordered outputted formatted songs titles separated by '|'. Give me a title and a 300 character limit description of the story. Make the song titles written in the description all capitalized. Make sure the description in its entirety is 300 characters, including the capitalized song title that might overflow the 300 character limit.\n\n${songTitles.join('|')}`;
    storyOutput.value = prompt;
}

async function createSpotifyPlaylist() {
    const playlistName = document.getElementById('playlistName').value;
    const playlistDescription = document.getElementById('playlistDescription').value;
    const songInput = document.getElementById('songInput').value;
    const songTitles = songInput.split('|').map(title => title.trim());

    if (!playlistName) {
        alert('Please enter a playlist name.');
        return;
    }

    if (playlistDescription.length > 300) {
        alert('Playlist description exceeds 300 characters.');
        return;
    }

    if (!songTitles.length) {
        alert('Song list is empty.');
        return;
    }

    if (!accessToken) {
        alert('Please log in to your spotify account, so we can fetch your playlist data.');
        return;
    }

    const unmatchedSongs = songTitles.filter(song => !fetchedSongs.some(fetchedSong => fetchedSong.title === song));
    if (unmatchedSongs.length > 0) {
        alert(`These songs are not part of the fetched playlist: ${unmatchedSongs.join(', ')}`);
        return;
    }

    const userResponse = await fetch('https://api.spotify.com/v1/me', {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    const userData = await userResponse.json();
    const userId = userData.id;

    const createPlaylistResponse = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: playlistName,
            description: playlistDescription,
            public: false
        })
    });
    const createPlaylistData = await createPlaylistResponse.json();
    const playlistId = createPlaylistData.id;

    const trackURIs = songTitles.map(title => {
        const matchedSong = fetchedSongs.find(song => song.title === title);
        return matchedSong ? matchedSong.uri : null;
    }).filter(uri => uri !== null);

    if (!trackURIs.length) {
        alert('No valid tracks found for the provided song titles.');
        return;
    }

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

    alert('Playlist created successfully!');
}

window.onload = function() {
    if (window.location.hash) {
        accessToken = getAccessTokenFromUrl();
        const activeTab = document.querySelector('.tab.active').textContent.trim();
        if (activeTab === 'Story Generator') {
            const playlistURL = localStorage.getItem('playlistURL');
            if (playlistURL) fetchSongsFromURL(playlistURL);
        } else if (activeTab === 'Genre Playlist Sorter') {
            const genrePlaylistURL = localStorage.getItem('genrePlaylistURL');
            if (genrePlaylistURL) fetchGenresFromURL(genrePlaylistURL);
        }
    }
};
