from fastmcp import FastMCP
import os

mcp = FastMCP("custom-mcp-server")

LOREM_FILE = os.path.join(os.path.dirname(__file__), "lorem-ipsum.md")


@mcp.resource("lorem://content/{word_count}")
def lorem_resource(word_count: int = 30) -> str:
    """Resource URI that reads from lorem-ipsum.md and returns N words."""
    with open(LOREM_FILE, "r", encoding="utf-8") as f:
        text = f.read()
    words = text.split()
    return " ".join(words[:word_count])


@mcp.tool()
def read(word_count: int = 30) -> str:
    """Read word_count words from lorem-ipsum.md. Default is 30 words."""
    with open(LOREM_FILE, "r", encoding="utf-8") as f:
        text = f.read()
    words = text.split()
    return " ".join(words[:word_count])


if __name__ == "__main__":
    mcp.run()