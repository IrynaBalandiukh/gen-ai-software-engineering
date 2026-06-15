function parseJSON(buffer) {
  return new Promise((resolve, reject) => {
    try {
      const text = buffer.toString('utf8');
      const data = JSON.parse(text);

      if (Array.isArray(data)) {
        resolve(data);
      } else if (data && typeof data === 'object' && Array.isArray(data.tickets)) {
        resolve(data.tickets);
      } else {
        reject(new Error('JSON must be an array or an object with a "tickets" property'));
      }
    } catch (err) {
      reject(new Error(`Invalid JSON: ${err.message}`));
    }
  });
}

module.exports = {
  parseJSON,
};
