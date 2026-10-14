import { reviewRequest } from '../../../../features/reviews/review-http.js'
export default defineEventHandler(event => reviewRequest(event, 'mine'))
