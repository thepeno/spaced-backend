import Logger from 'pino';
const logger = Logger({
	level: 'info',
	transport: {
		target: 'pino-pretty',
		options: {
			singleLine: true,
			colorize: true,
			levelFirst: true,
			translateTime: true,
		},
	},
});

export default logger;
