# Contribute accessible parking data

Use a pull request to suggest a new area or correct an existing dataset. Council open data, GIS exports and official parking maps are good starting points. Check that the source licence permits redistribution before uploading a copy. If a copy can’t be shared, include the source link in the pull request instead.

1. Export the data as a GeoJSON `FeatureCollection` in WGS 84. Coordinates go in `[longitude, latitude]` order. Use one feature per mapped bay, approximate location or car park. Give each feature a street, landmark or car park name where available. Keep official references and restrictions, and identify approximate and car park-level locations clearly. Use `"geometry": null` for records with unknown coordinates, or omit those records.
2. Open the map, choose **Add your area**, and upload or paste the GeoJSON. Check the feature count and spot-check the pins against the source. [Open the parking map](https://m-rk.github.io/acrod-map/)
3. Fork `m-rk/acrod-map` and create a branch. Add the file to `sources/` in your fork with a descriptive name such as `city-of-example.geojson`. [Fork the repository](https://github.com/m-rk/acrod-map/fork)
4. Open a pull request from your branch to `m-rk/acrod-map` on `main`. Include the council or area, source URL, licence, date retrieved, what the points represent and any known gaps. For a correction, describe what changed. [GitHub’s guide to pull requests from forks](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request-from-a-fork)

Files in `sources/` are reviewed before they’re added to the public map. [See the existing council data and attribution](../data/README.md)
