export function withDefaultCloudUrl(saved, packagedUrl = '') {
    return saved?.url ? saved : { url: process.env.VUE_APP_MONA_CLOUD_URL || packagedUrl }
}
