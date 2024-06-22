const clientId = 'f6e537a709ed4244a7da8a33c1cb24ad';
const redirectUri = 'https://justinsoon.io/spotifytools/';
const scopes = 'playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public user-library-read';
let accessToken = '', fetchedSongs = [], similarSongs = [];

const elements = {
    storyPlaylistURL: document.getElementById('storyPlaylistURL'),
    genrePlaylistURL: document.getElementById('genrePlaylistURL'),
    similarPlaylistURL: document.getElementById('similarPlaylistURL'),
    songList: document.getElementById('songList'),
    storyOutput: document.getElementById('storyOutput'),
    songPromptContainer: document.getElementById('songPromptContainer'),
    notification: document.getElementById('notification')
};

function authenticate() {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
    window.location = authUrl;
}

function logout() {
    accessToken = '';
    localStorage.removeItem('storyPlaylistURL');
    localStorage.removeItem('genrePlaylistURL');
    localStorage.removeItem('similarPlaylistURL');
    elements.storyPlaylistURL.value = '';
    elements.genrePlaylistURL.value = '';
    elements.similarPlaylistURL.value = '';
    document.querySelector('.profile-picture').classList.add('hidden');
    document.querySelector('.logout-button').classList.add('hidden');
    document.querySelector('.login-button').classList.remove('hidden');
    showNotification('Logged out successfully.');
}

function createLoginButton() {
    const loginButton = document.createElement('button');
    loginButton.className = 'login-button';
    loginButton.textContent = 'Log in';
    loginButton.onclick = authenticate;
    return loginButton;
}

function showTab(tab) {
    document.querySelectorAll('.tab, .tab-content').forEach(el => el.classList.remove('active'));
    document.querySelector(`.tab[onclick="showTab('${tab}')"]`).classList.add('active');
    document.getElementById(tab).classList.add('active');
}

function showNotification(message) {
    elements.notification.textContent = message;
    elements.notification.classList.remove('hide');
    elements.notification.classList.add('show');
    setTimeout(() => {
        elements.notification.classList.remove('show');
        elements.notification.classList.add('hide');
    }, 8000);
}

function closeModal() {
    document.getElementById('editPlaylistDetailsModal').style.display = 'none';
}

function openModal() {
    document.getElementById('editPlaylistDetailsModal').style.display = 'block';
}

async function savePlaylistDetails() {
    const playlistName = document.getElementById('playlistNameInput').value;
    const playlistDescription = document.getElementById('playlistDescriptionInput').value;
    const songInput = document.getElementById('songInputModal').value;
    const songTitles = songInput.split('|').map(title => title.trim().toLowerCase());

    if (!playlistName) return showNotification('Please enter a playlist name.');
    if (playlistDescription.length > 300) return showNotification('Playlist description exceeds 300 characters.');
    if (!songTitles.length) return showNotification('Song list is empty.');
    if (!accessToken) return showNotification('Please log in to your Spotify account.');

    const fetchedSongsMap = new Map(fetchedSongs.map(song => [song.title.toLowerCase(), song.uri]));
    const matchedUris = songTitles.map(title => fetchedSongsMap.get(title)).filter(uri => uri);

    if (!matchedUris.length) return showNotification('No matching songs found.');

    await createSpotifyPlaylist(playlistName, playlistDescription, matchedUris);
    closeModal();
    showNotification('Playlist created successfully!');
}

function fetchStorySongs() {
    const storyPlaylistURL = elements.storyPlaylistURL.value;
    if (!storyPlaylistURL) {
        showNotification('Please enter a valid Spotify playlist URL.');
        return;
    }
    localStorage.setItem('storyPlaylistURL', storyPlaylistURL);
    fetchSongsFromURL(storyPlaylistURL).then(() => {
        document.querySelectorAll('#songPromptContainer .flex-item.section').forEach(item => item.classList.remove('hidden'));
        document.getElementById('createPlaylistButton').classList.remove('hidden');
    });
}

async function fetchSongsFromURL(playlistURL) {
    const playlistId = extractPlaylistId(playlistURL);
    if (!playlistId) return showNotification('Invalid playlist URL.');

    accessToken = getAccessTokenFromUrl();
    if (!accessToken) return showNotification('Please log in to your Spotify account.');

    fetchedSongs = [];
    let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`, data;
    do {
        data = await fetchData(url);
        if (!data.items) return showNotification('Failed to fetch playlist.');
        fetchedSongs.push(...data.items.map(item => ({
            title: item.track.name,
            uri: item.track.uri,
            id: item.track.id
        })));
        url = data.next;
    } while (data.next);

    elements.songList.value = fetchedSongs.map(song => song.title).join('\n');
    elements.storyOutput.value = `Make a story or subliminal message by only using these song titles. Re-organize, but do not remove any of the songs, to make the story captivating and fluent. Give the entire re-ordered outputted formatted songs titles separated by '|'. Give me a title and a 300 character limit description of the story. Make the song titles written in the description all capitalized. Make sure the description in its entirety is 300 characters, including the capitalized song title that might overflow the 300 character limit.\n\n ${fetchedSongs.map(song => song.title).join('|')}`
}

function fetchAndDisplayGenres() {
    const genrePlaylistURL = elements.genrePlaylistURL.value;
    if (!genrePlaylistURL) return showNotification('Please enter a valid Spotify playlist URL.');
    localStorage.setItem('genrePlaylistURL', genrePlaylistURL);
    createGenrePlaylists(genrePlaylistURL);
}

async function createGenrePlaylists(playlistURL) {
    const playlistId = extractPlaylistId(playlistURL);
    if (!playlistId) return showNotification('Invalid playlist URL.');

    accessToken = getAccessTokenFromUrl();
    if (!accessToken) return showNotification('Please log in to your Spotify account.');

    let genreSongs = [], url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`, data;
    do {
        data = await fetchData(url);
        if (!data.items) return showNotification('Failed to fetch playlist.');
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
            if (!track) continue;
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
    if (!accessToken) return showNotification('Access token is missing. Please authenticate.');

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

async function createSimilarPlaylist() {
    const similarPlaylistURL = elements.similarPlaylistURL.value;
    if (!similarPlaylistURL) return showNotification('Please enter a valid Spotify playlist URL.');
    await fetchSimilarSongsFromURL(similarPlaylistURL);
}

async function fetchSimilarSongsFromURL(playlistURL) {
    const playlistId = extractPlaylistId(playlistURL);
    if (!playlistId) return showNotification('Invalid playlist URL.');

    accessToken = getAccessTokenFromUrl();
    if (!accessToken) return showNotification('Please log in to your Spotify account.');

    fetchedSongs = [];
    let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`, data;
    do {
        data = await fetchData(url);
        if (!data.items) return showNotification('Failed to fetch playlist.');
        fetchedSongs.push(...data.items.map(item => ({
            title: item.track.name,
            uri: item.track.uri,
            id: item.track.id
        })));
        url = data.next;
    } while (data.next);

    similarSongs = await fetchSimilarTracks(fetchedSongs);
    const originalPlaylistData = await fetchData(`https://api.spotify.com/v1/playlists/${playlistId}`);
    const originalPlaylistName = originalPlaylistData.name;
    const description = `A playlist with songs similar to those in the [original playlist](${playlistURL}).`;
    const name = `Similar Playlist To ${originalPlaylistName}`;

    await createSpotifyPlaylist(name, description, similarSongs.map(song => song.uri));
    showNotification('Similar playlist created successfully!');
}

async function fetchSimilarTracks(tracks) {
    const similarTracks = [];
    for (const track of tracks) {
        const similarTrackData = await fetchData(`https://api.spotify.com/v1/recommendations?seed_tracks=${track.id}&limit=10`);
        similarTracks.push(...similarTrackData.tracks.filter(similarTrack => !tracks.some(t => t.id === similarTrack.id)));
    }
    return similarTracks.slice(0, 50);
}

async function createSpotifyPlaylist(name, description, uris) {
    const userResponse = await fetchData('https://api.spotify.com/v1/me');
    const userId = userResponse.id;

    const createPlaylistResponse = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: name,
            description: description,
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
}

async function fetchData(url, retries = 3) {
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : 3000;
        showNotification('Spotify API is getting rate limited. Please wait.');
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
        if (playlistIndex !== -1 && paths[playlistIndex + 1]) return paths[playlistIndex + 1];
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
    const profilePicture = document.querySelector('.profile-picture');
    profilePicture.innerHTML = `<img src="${profile.images[0].url}" alt="Profile Picture">`;
    profilePicture.classList.remove('hidden');
    document.querySelector('.logout-button').classList.remove('hidden');
    document.querySelector('.login-button').classList.add('hidden');
}

async function fetchUserProfile() {
    const response = await fetch('https://api.spotify.com/v1/me', { headers: { 'Authorization': `Bearer ${accessToken}` } });
    if (!response.ok) return console.error('Failed to fetch user profile:', response.statusText);
    const profile = await response.json();
    displayUserProfile(profile);
}

function checkVisibility() {
    if (elements.storyPlaylistURL.value && fetchedSongs.length > 0 && accessToken) {
        elements.songPromptContainer.classList.remove('hidden');
    } else {
        elements.songPromptContainer.classList.add('hidden');
    }
}

function checkSimilarVisibility() {
    const similarSongsContainer = document.getElementById('similarSongsContainer');
    if (similarSongsContainer) {
        const similarPlaylistURL = elements.similarPlaylistURL.value;
        if (similarPlaylistURL && similarSongs.length > 0 && accessToken) {
            similarSongsContainer.classList.remove('hidden');
        } else {
            similarSongsContainer.classList.add('hidden');
        }
    }
}

window.onload = function() {
    elements.songPromptContainer.classList.add('hidden');

    if (window.location.hash) {
        accessToken = getAccessTokenFromUrl();
        fetchUserProfile();

        const activeTab = document.querySelector('.tab.active').textContent.trim();
        if (activeTab === 'Spotify Story') {
            const storyPlaylistURL = localStorage.getItem('storyPlaylistURL');
            if (storyPlaylistURL) {
                elements.storyPlaylistURL.value = storyPlaylistURL;
                fetchSongsFromURL(storyPlaylistURL).then(checkVisibility);
            } else {
                checkVisibility();
            }
        } else if (activeTab === 'Genre Sorter') {
            const genrePlaylistURL = localStorage.getItem('genrePlaylistURL');
            if (genrePlaylistURL) {
                elements.genrePlaylistURL.value = genrePlaylistURL;
                createGenrePlaylists(genrePlaylistURL).then(checkVisibility);
            } else {
                checkVisibility();
            }
        } else if (activeTab === 'Similar Playlist') {
            const similarPlaylistURL = localStorage.getItem('similarPlaylistURL');
            if (similarPlaylistURL) {
                elements.similarPlaylistURL.value = similarPlaylistURL;
                fetchSimilarSongsFromURL(similarPlaylistURL).then(checkSimilarVisibility);
            } else {
                checkSimilarVisibility();
            }
        }
    } else {
        checkVisibility();
    }
};

elements.storyPlaylistURL.addEventListener('input', checkVisibility);
elements.genrePlaylistURL.addEventListener('input', checkVisibility);
elements.similarPlaylistURL.addEventListener('input', checkSimilarVisibility);

async function createCustomDiscoverPlaylist() {
    accessToken = getAccessTokenFromUrl();
    if (!accessToken) return showNotification('Please log in to your Spotify account.');

    const likedSongs = await fetchLikedSongs();
    const seedTracks = likedSongs.slice(0, 5).map(song => song.id); // Use up to 5 seed tracks
    const recommendations = await fetchRecommendations(seedTracks);
    const recentSongs = recommendations.filter(song => isSongRecent(song, 7));

    if (recentSongs.length === 0) return showNotification('No recent songs found in the recommendations.');

    const playlistName = 'Custom Discover Playlist';
    const description = 'A playlist with songs recommended based on your liked songs, released in the last week.';

    await createSpotifyPlaylist(playlistName, description, recentSongs.map(song => song.uri));
    showNotification('Custom Discover playlist created successfully!');
}

async function fetchLikedSongs() {
    let url = 'https://api.spotify.com/v1/me/tracks?limit=50', data, likedSongs = [];
    do {
        data = await fetchData(url);
        if (!data.items) return showNotification('Failed to fetch liked songs.');
        likedSongs.push(...data.items.map(item => ({
            title: item.track.name,
            uri: item.track.uri,
            id: item.track.id,
            releaseDate: item.track.album.release_date
        })));
        url = data.next;
    } while (data.next);
    return likedSongs;
}

async function fetchRecommendations(seedTracks) {
    const url = `https://api.spotify.com/v1/recommendations?limit=50&seed_tracks=${seedTracks.join(',')}`;
    const data = await fetchData(url);
    if (!data.tracks) return showNotification('Failed to fetch recommendations.');
    return data.tracks.map(track => ({
        title: track.name,
        uri: track.uri,
        id: track.id,
        releaseDate: track.album.release_date
    }));
}

function isSongRecent(song, days) {
    const today = new Date();
    const releaseDate = new Date(song.releaseDate);
    const timeDifference = today - releaseDate;
    const dayDifference = timeDifference / (1000 * 3600 * 24);
    return dayDifference <= days;
}
