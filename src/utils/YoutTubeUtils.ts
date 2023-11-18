const REG_YOUTUBE = /^(?:http(?:s)?:\/\/)?(?:www\.)?youtu(?:be\.com|\.be)\/(embed\/|watch\?v=|shorts\/|playlist\?list=|embed\/videoseries\?list=)?([a-zA-Z0-9_-]+)(?:\?t=|.*&t=|\?start=|.*&start=)?([a-zA-Z0-9_-]+)?[^\s]*$/;
export const isYouTube = (url: string): boolean => {
  return Boolean(
    url.match(REG_YOUTUBE)
  );
}

export const getYouTubeStartAt = (url: string): string => {
  const ytLink = url.match(REG_YOUTUBE);
  if (ytLink?.[2]) {
    const time = ytLink[3] ? parseInt(ytLink[3]) : 0;
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time - hours * 3600) / 60);
    const seconds = time - hours * 3600 - minutes * 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return "00:00:00";
};

export const isValidYouTubeStart = (value: string): boolean => {
  if(/^[0-9]+$/.test(value)) return true; // Matches only numbers (seconds)
  if(/^[0-9]+:[0-9]+$/.test(value)) return true; // Matches only numbers (minutes and seconds)
  if(/^[0-9]+:[0-9]+:[0-9]+$/.test(value)) return true; // Matches only numbers (hours, minutes, and seconds
};

export const updateYouTubeStartTime = (link: string, startTime: string): string => {
  const match = link.match(REG_YOUTUBE);
  if (match?.[2]) {
    const startTimeParam = `t=${timeStringToSeconds(startTime)}`;
    let updatedLink = link;
    if (match[3]) {
      // If start time already exists, update it
      updatedLink = link.replace(/([?&])t=[a-zA-Z0-9_-]+/, `$1${startTimeParam}`);
      updatedLink = updatedLink.replace(/([?&])start=[a-zA-Z0-9_-]+/, `$1${startTimeParam}`);
    } else {
      // If no start time exists, add it to the link
      updatedLink += (link.includes('?') ? '&' : '?') + startTimeParam;
    }
    return updatedLink;
  }
  return link;
};

const timeStringToSeconds = (time: string): number => {
  const timeParts = time.split(':').map(Number);
  const totalParts = timeParts.length;

  if (totalParts === 1) {
    return timeParts[0]; // Only seconds provided (ss)
  } else if (totalParts === 2) {
    return timeParts[0] * 60 + timeParts[1]; // Minutes and seconds provided (mm:ss)
  } else if (totalParts === 3) {
    return timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2]; // Hours, minutes, and seconds provided (hh:mm:ss)
  }

  return 0; // Invalid format, return 0 or handle accordingly
};