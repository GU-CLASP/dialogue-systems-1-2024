feature_value_forms = {
    'energy_mean': {
        True: 'music with high energy',
        False: 'music with low energy',
    },
    'mode_0_percentage': {
        True: 'music in major mode',
        False: 'music in minor mode',
    },
    'loudness_mean': {
        True: 'loud music',
        False: 'silent music',
    },
    'speechiness_mean': {
        True: '"speechy" music',
        False: '"non-speechy" music',
    },
    'instrumentalness_mean': {
        True: 'instrumental music',
        False: 'non-instrumental music',
    },
    'valence_mean': {
        True: 'music with high valence',
        False: 'music with low valence',
    },
    'danceability_mean': {
        True: 'danceable music',
        False: 'music that is not danceable'
    },
}


feature_np = {
    'energy_mean': 'energy',
    'mode_0_percentage': 'mode',
    'loudness_mean': 'loudness',
    'speechiness_mean': 'speechiness',
    'instrumentalness_mean': 'instrumentalness',
    'valence_mean': 'valence',
    'danceability_mean': 'danceability',
}
