const clientId = 'f6e537a709ed4244a7da8a33c1cb24ad';
const redirectUri = 'http://justinsoon.io/spotifytools';
const scopes = 'playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public user-library-read user-top-read';
let accessToken = '';
const fetchedArtists = new Map();
const fetchedTracks = new Set();
const fetchedGenres = new Map();
const fetchedSongs = [];

const genreList = [
    "acoustic", "afrobeat", "alt-rock", "alternative", "ambient", "anime", "black-metal", "bluegrass", "blues", "bossanova",
    "brazil", "breakbeat", "british", "cantopop", "chicago-house", "children", "chill", "classical", "club", "comedy",
    "country", "dance", "dancehall", "death-metal", "deep-house", "detroit-techno", "disco", "disney", "drum-and-bass", "dub",
    "dubstep", "edm", "electro", "electronic", "emo", "folk", "forro", "french", "funk", "garage", "german", "gospel",
    "goth", "grindcore", "groove", "grunge", "guitar", "happy", "hard-rock", "hardcore", "hardstyle", "heavy-metal",
    "hip-hop", "holidays", "honky-tonk", "house", "idm", "indian", "indie", "indie-pop", "industrial", "iranian", "j-dance",
    "j-idol", "j-pop", "j-rock", "jazz", "k-pop", "kids", "latin", "latino", "malay", "mandopop", "metal", "metal-misc",
    "metalcore", "minimal-techno", "movies", "mpb", "new-age", "new-release", "opera", "pagode", "party", "philippines-opm",
    "piano", "pop", "pop-film", "post-dubstep", "power-pop", "progressive-house", "psych-rock", "punk", "punk-rock", "r-n-b",
    "rainy-day", "reggae", "reggaeton", "road-trip", "rock", "rock-n-roll", "rockabilly", "romance", "sad", "salsa", "samba",
    "sertanejo", "show-tunes", "singer-songwriter", "ska", "sleep", "songwriter", "soul", "soundtracks", "spanish", "study",
    "summer", "swedish", "synth-pop", "tango", "techno", "trance", "trip-hop", "turkish", "work-out", "world-music"
];

const elements = {
    storyPlaylistURL: document.getElementById('storyPlaylistURL'),
    genrePlaylistURL: document.getElementById('genrePlaylistURL'),
    similarPlaylistURL: document.getElementById('similarPlaylistURL'),
    songList: document.getElementById('songList'),
    storyOutput: document.getElementById('storyOutput'),
    songPromptContainer: document.getElementById('songPromptContainer'),
    notification: document.getElementById('notification'),
    genreResults: document.getElementById('genreResults')
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

async function fetchWebApi(endpoint, method, body, retries = 3, retryDelay = 1000) {
    const url = endpoint.startsWith('https://') ? endpoint : `https://api.spotify.com/v1/${endpoint}`;
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        method,
        body: body ? JSON.stringify(body) : null
    });

    if (res.status === 429) { // Handle rate limiting
        const retryAfter = res.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : retryDelay;
        if (retries > 0) {
            console.log(`Rate limited. Retrying in ${waitTime / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return fetchWebApi(endpoint, method, body, retries - 1, waitTime * 2); // Exponential backoff
        } else {
            throw new Error('Too many requests. Please try again later.');
        }
    }

    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error('Failed to parse response:', text);
        return null;
    }
}


async function createCustomDiscoverPlaylist() {
    showNotification('Creating Custom Discover Playlist...');
    accessToken = getAccessTokenFromUrl();
    if (!accessToken) return showNotification('Please login to your Spotify account.');

    await fetchTopItems();

    if (fetchedArtists.size === 0 || fetchedTracks.size === 0) return showNotification('No artists or tracks found.');

    const seedArtists = Array.from(fetchedArtists.keys()).slice(0, 2).join(',');
    const seedTracks = Array.from(fetchedTracks).slice(0, 3).join(',');
    const recommendations = await fetchRecommendations(seedArtists, seedTracks, 100, '');

    if (!recommendations || !Array.isArray(recommendations)) {
        console.error('Failed to fetch recommendations:', recommendations);
        return showNotification('Failed to fetch recommendations.');
    }

    const filteredRecommendations = recommendations.filter(song => !fetchedTracks.has(song.id));
    const recentSongs = filteredRecommendations.filter(song => isSongRecent(song, 60));

    if (recentSongs.length === 0) return showNotification('No recent songs found in the recommendations.');

    const playlistName = 'Personalized Discover Monthly';
    const description = 'A playlist with songs recommended based on your top tracks and artists, released recently. Made with https://justinsoon.io/spotifytools';

    await createSpotifyPlaylist(playlistName, description, recentSongs.map(song => song.uri));
    showNotification('Custom Discover playlist created successfully!');
}

async function fetchTopItems() {
    const data = await fetchWebApi(`me/top/tracks?limit=3&fields=items(id,artists(id))`, 'GET');
    if (!data || !data.items) return showNotification('Failed to fetch top tracks.');
    for (const item of data.items) {
        fetchedTracks.add(item.id);
        for (const artist of item.artists) {
            incrementMapCount(fetchedArtists, artist.id);
        }
    }

    const topArtists = await fetchWebApi('me/top/artists?limit=2&fields=items(id)', 'GET');
    if (!topArtists || !topArtists.items) return showNotification('Failed to fetch top artists.');
    for (const artist of topArtists.items) {
        incrementMapCount(fetchedArtists, artist.id);
    }
}

async function createSimilarPlaylist() {
    showNotification('Creating Similar Playlist...');
    const similarPlaylistURL = elements.similarPlaylistURL.value;
    if (!similarPlaylistURL) return showNotification('Please enter a valid Spotify playlist URL.');

    const playlistId = extractPlaylistId(similarPlaylistURL);
    if (!playlistId) return showNotification('Invalid playlist URL.');

    accessToken = getAccessTokenFromUrl();
    if (!accessToken) return showNotification('Please login to your Spotify account.');

    await fetchTracksArtistsGenres(playlistId);

    if (fetchedArtists.size === 0 || fetchedTracks.size === 0) return showNotification('No seed artists or tracks found.');

    const seedArtists = Array.from(fetchedArtists.keys()).slice(0, 2).join(',');
    const seedTracks = Array.from(fetchedTracks).slice(0, 3).join(',');
    const recommendations = await fetchRecommendations(seedArtists, seedTracks, 100, '');

    if (!recommendations || !Array.isArray(recommendations)) {
        console.error('Failed to fetch recommendations:', recommendations);
        return showNotification('Failed to fetch recommendations.');
    }

    const filteredRecommendations = recommendations.filter(song => !fetchedTracks.has(song.id));

    if (filteredRecommendations.length === 0) return showNotification('No similar songs found in the recommendations.');

    const originalPlaylistData = await fetchWebApi(`playlists/${playlistId}?fields=name`, 'GET');
    const originalPlaylistName = originalPlaylistData.name;
    const description = `A playlist with songs similar to those in the ${similarPlaylistURL}. Made with https://justinsoon.io/spotifytools`;
    const name = `A Playlist Similar To ${originalPlaylistName}`;

    await createSpotifyPlaylist(name, description, filteredRecommendations.map(song => song.uri));
    showNotification('Similar playlist created successfully!');
}

async function fetchTracksArtistsGenres(playlistId) {
    fetchedTracks.clear();
    fetchedArtists.clear();
    fetchedGenres.clear();

    let url = `playlists/${playlistId}/tracks?limit=50&fields=items(track(id,artists(id))),next`,
        data;
    do {
        data = await fetchWebApi(url, 'GET');
        if (!data || !data.items) return showNotification('Failed to fetch playlist.');
        for (const item of data.items) {
            const track = item.track;
            fetchedTracks.add(track.id);
            track.artists.forEach(artist => incrementMapCount(fetchedArtists, artist.id));
        }
        url = data.next;
    } while (data.next);
}

async function fetchRecommendations(seedArtists, seedTracks, limit = 100, seedGenres = '') {
    let url = `recommendations?limit=${limit}&seed_artists=${encodeURIComponent(seedArtists)}&seed_tracks=${encodeURIComponent(seedTracks)}`;
    if (seedGenres) {
        url += `&seed_genres=${encodeURIComponent(seedGenres)}`;
    }
    console.log('Fetching recommendations with URL:', url);
    const data = await fetchWebApi(url, 'GET');
    if (!data || !data.tracks) {
        console.error('Failed to fetch recommendations:', data);
        return null;
    }
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

async function createSpotifyPlaylist(name, description, uris) {
    const userResponse = await fetchWebApi('me', 'GET');
    const userId = userResponse.id;

    const createPlaylistResponse = await fetchWebApi(`users/${userId}/playlists`, 'POST', {
        name: name,
        description: description,
        public: false
    });
    const playlistId = createPlaylistResponse.id;

    await fetchWebApi(`playlists/${playlistId}/tracks`, 'POST', {
        uris: uris
    });
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
    const profile = await fetchWebApi('me', 'GET');
    displayUserProfile(profile);
}

function incrementMapCount(map, key) {
    map.set(key, (map.get(key) || 0) + 1);
}

function getTopGenres(map, limit) {
    return new Map(Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit));
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

async function fetchStorySongs() {
    showNotification('Fetching songs for Spotify Story...');
    const storyPlaylistURL = elements.storyPlaylistURL.value;
    if (!storyPlaylistURL) {
        showNotification('Please enter a valid Spotify playlist URL.');
        return;
    }
    localStorage.setItem('storyPlaylistURL', storyPlaylistURL);
    await fetchSongsFromURL(storyPlaylistURL);
    document.querySelectorAll('#songPromptContainer .flex-item.section').forEach(item => item.classList.remove('hidden'));
    document.getElementById('createPlaylistButton').classList.remove('hidden');
    showNotification('Songs fetched for Spotify Story successfully!');
}

async function fetchSongsFromURL(playlistURL) {
    const playlistId = extractPlaylistId(playlistURL);
    if (!playlistId) return showNotification('Invalid playlist URL.');

    accessToken = getAccessTokenFromUrl();
    if (!accessToken) return showNotification('Please log in to your Spotify account.');

    fetchedSongs.length = 0;
    let endpoint = `playlists/${playlistId}/tracks?limit=50&fields=items(track(name,uri,id)),next`,
        data;
    do {
        data = await fetchWebApi(endpoint, 'GET');
        if (!data || !data.items) return showNotification('Failed to fetch playlist.');
        fetchedSongs.push(...data.items.map(item => ({
            title: item.track.name,
            uri: item.track.uri,
            id: item.track.id
        })));
        endpoint = data.next;
    } while (data.next);

    elements.songList.value = fetchedSongs.map(song => song.title).join('\n');
    elements.storyOutput.value = `Make a story or subliminal message by only using these song titles. Re-organize, but do not remove any of the songs, to make the story captivating and fluent. Give the entire re-ordered outputted formatted songs titles separated by '|'. Give me a title and a 300 character limit description of the story. Make the song titles written in the description all capitalized. Make sure the description in its entirety is 300 characters, including the capitalized song title that might overflow the 300 character limit.\n\n ${fetchedSongs.map(song => song.title).join('|')}`
}


async function fetchAndDisplayGenres() {
    showNotification('Starting Genre Sorter... Please Wait!');
    const genrePlaylistURL = elements.genrePlaylistURL.value;
    if (!genrePlaylistURL) return showNotification('Please enter a valid Spotify playlist URL.');
    localStorage.setItem('genrePlaylistURL', genrePlaylistURL);
    await createGenrePlaylists(genrePlaylistURL);
    showNotification('Genre sorting completed!');
}

async function createGenrePlaylists(playlistURL) {
    const playlistId = extractPlaylistId(playlistURL);
    if (!playlistId) return showNotification('Invalid playlist URL.');

    accessToken = getAccessTokenFromUrl();
    if (!accessToken) return showNotification('Please log into your Spotify account.');

    let genreSongs = [],
        endpoint = `playlists/${playlistId}/tracks?limit=50&fields=items(track(id,uri,name,artists(id,name))),next`,
        data;
    do {
        data = await fetchWebApi(endpoint, 'GET');
        if (!data || !data.items) return showNotification('Failed to fetch playlist.');
        genreSongs.push(...data.items.map(item => ({
            id: item.track.id,
            uri: item.track.uri,
            name: item.track.name,
            artists: item.track.artists.map(artist => ({
                id: artist.id,
                name: artist.name
            }))
        })));
        endpoint = data.next;
    } while (data.next);

    await fetchTrackGenresAndCreatePlaylists(genreSongs);
}

async function fetchTrackGenresAndCreatePlaylists(tracks) {
    const genreMap = {};
    for (let i = 0; i < tracks.length; i += 50) {
        const batch = tracks.slice(i, i + 50);
        const ids = batch.map(track => track.id).join(',');

        const trackData = await fetchWebApi(`tracks?ids=${ids}&fields=tracks(id,name,uri,artists(id,name))`, 'GET');
        for (const track of trackData.tracks) {
            if (!track) continue;
            for (const artist of track.artists) {
                const artistData = await fetchWebApi(`artists/${artist.id}?fields=genres`, 'GET');
                if (artistData.genres && artistData.genres.length > 0) {
                    const mainGenre = getMainGenre(artistData.genres);
                    if (!genreMap[mainGenre]) genreMap[mainGenre] = new Set();
                    genreMap[mainGenre].add(track.uri);
                }
            }
        }
    }

    accessToken = getAccessTokenFromUrl();
    if (!accessToken) return showNotification('Please log into your Spotify account.');

    const userResponse = await fetchWebApi('me', 'GET');
    const userId = userResponse.id;

    for (const genre of Object.keys(genreMap)) {
        const tracks = Array.from(genreMap[genre]);
        if (tracks.length === 0) continue;

        const createPlaylistResponse = await fetchWebApi(`users/${userId}/playlists`, 'POST', {
            name: genre,
            description: 'Made with Spotify Tools - https://justinsoon.io/spotifytools',
            public: false
        });
        const playlistId = createPlaylistResponse.id;

        await fetchWebApi(`playlists/${playlistId}/tracks`, 'POST', {
            uris: tracks
        });

        console.log(`Added tracks to ${genre} playlist`);
    }

    showNotification('Genre playlists created successfully!');
}

function getMainGenre(genres) {
    for (const genre of genres) {
        if (genreList.includes(genre)) {
            return genre;
        }
    }
    return 'Unknown Genre';
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
                fetchSongsFromURL(storyPlaylistURL);
            }
        } else if (activeTab === 'Genre Sorter') {
            const genrePlaylistURL = localStorage.getItem('genrePlaylistURL');
            if (genrePlaylistURL) {
                elements.genrePlaylistURL.value = genrePlaylistURL;
                fetchAndDisplayGenres();
            }
        } else if (activeTab === 'Similar Playlist') {
            const similarPlaylistURL = localStorage.getItem('similarPlaylistURL');
            if (similarPlaylistURL) {
                elements.similarPlaylistURL.value = similarPlaylistURL;
                createSimilarPlaylist();
            }
        }
    }
};

elements.storyPlaylistURL.addEventListener('input', () => {});
elements.genrePlaylistURL.addEventListener('input', () => {});
elements.similarPlaylistURL.addEventListener('input', () => {});
