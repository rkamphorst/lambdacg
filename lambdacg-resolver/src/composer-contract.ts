import { HandlerResponse } from 'lambdacg-contract';

type ComposeFunction = (responseTemplate: HandlerResponse, responses: HandlerResponse[]) => HandlerResponse;

export { ComposeFunction };
