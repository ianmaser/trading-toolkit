import '@testing-library/jest-dom'

// Environment variables available to all tests
process.env.POLYGON_API_KEY = 'test-polygon-key'
process.env.TWELVE_DATA_API_KEY = 'test-twelve-key'
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
