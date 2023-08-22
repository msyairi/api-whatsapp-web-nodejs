const qrcode = require('qrcode-terminal');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const { body, validationResult } = require('express-validator');
const { phoneNumberFormatter } = require('./helpers/formatter');
const axios = require('axios').default;

// ------ Whatsapp API Initialize
const client = new Client({
	restartOnAuthFail: true,
	puppeteer: {
		headless: true,
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-dev-shm-usage',
			'--disable-accelerated-2d-canvas',
			'--no-first-run',
			'--no-zygote',
			'--single-process', // <- this one doesn't works in Windows
			'--disable-gpu'
		],
	},
	authStrategy: new LocalAuth({clientId: "client-one"})
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('authenticated', () => {
	// console.log('Authenticated - success');
});

client.on('auth_failure', function(session) {
	console.log('Authenticated - failed', session);
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('disconnected', (reason) => {
	client.destroy();
	client.initialize();
});

client.on('message', message => {
	let chat = message.getChat();

	if (chat.isGroup) {
		// this chat when group type
	}
	else {
		if(message.body === '!ping') {
			message.reply('pong');
		}
	}
});

client.initialize();

// ------ functions
const checkRegisteredNumber = async function(number) {
	const isRegistered = await client.isRegisteredUser(number);
	return isRegistered;
}

// ------ express minimalist web framework
const app = express();
app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

app.get('/', function (req, res) {
	res.status(200).json({
		status: 404,
		message: "Object not found!"
	});
});

// --- send message text
app.post('/send-message', [
	body('number').notEmpty(),
	body('message').notEmpty(),
], async (req, res) => {
	const errors = validationResult(req).formatWith(({
		msg
	}) => {
		return msg;
	});

	if (!errors.isEmpty()) {
		return res.status(422).json({
			status: 422,
			message: errors.mapped()
		});
	}

	const number = phoneNumberFormatter(req.body.number);
	const message = req.body.message;

	const isRegisteredNumber = await checkRegisteredNumber(number);

	if (!isRegisteredNumber) {
		return res.status(422).json({
			status: 422,
			message: 'The number is not registered'
		});
	}
	
	client.sendMessage(number, message).then(response => {
		res.status(200).json({
			status: 200,
			response: response
		});
	}).catch(err => {
		res.status(500).json({
			status: 500,
			response: err
		});
	});
});

// --- send message media file
app.post('/send-media-static', async (req, res) => {
	const number 	= phoneNumberFormatter(req.body.number);
	const filename 	= req.body.filename;
	const caption 	= req.body.caption;
	const media 	= MessageMedia.fromFilePath('./media/' + filename);

	const isRegisteredNumber = await checkRegisteredNumber(number);

	if (!isRegisteredNumber) {
		return res.status(422).json({
			status: 422,
			message: 'The number is not registered'
		});
	}
	
	client.sendMessage(number, media, {caption : caption}).then(response => {
		res.status(200).json({
			status: 200,
			response: response
		});
	}).catch(err => {
		res.status(500).json({
			status: 500,
			response: err
		});
	});
});

// --- send message media url
app.post('/send-media-url', async (req, res) => {
	const number 	= phoneNumberFormatter(req.body.number);
	const caption 	= req.body.caption;
	const fileUrl 	= req.body.file;

	let mimetype;
	const attachment = await axios.get(fileUrl, {
		responseType: 'arraybuffer'
	}).then(response => {
		mimetype = response.headers['content-type'];
		return response.data.toString('base64');
	});

	const media = new MessageMedia(mimetype, attachment, caption);

	const isRegisteredNumber = await checkRegisteredNumber(number);

	if (!isRegisteredNumber) {
		return res.status(422).json({
			status: 422,
			message: 'The number is not registered'
		});
	}
	
	client.sendMessage(number, media, { caption : caption }).then(response => {
		res.status(200).json({
			status: 200,
			response: response
		});
	}).catch(err => {
		res.status(500).json({
			status: 500,
			response: err
		});
	});
});

app.listen(8000);